import userEvent from '@testing-library/user-event';
import { times } from 'lodash';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { type DataFrame, toDataFrame } from '@grafana/data';
import { ExpressionDatasourceRef, FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { buildDynamicThreshold } from 'app/features/expressions/components/DynamicThreshold/buildDynamicThreshold';
import {
  type DynamicThresholdPolicyV1,
  ExpressionQueryType,
  type SqlExpressionQuery,
} from 'app/features/expressions/types';

import { EvalFunction } from '../../../state/alertDef';

import { Expression, ExpressionResult, getGroupedByStateAndSeriesCount } from './Expression';

const mockDynamicThresholdEditor = jest.fn((_props: unknown) => <div data-testid="dynamic-threshold-editor" />);

jest.mock('app/features/expressions/components/DynamicThreshold/DynamicThresholdEditor', () => ({
  DynamicThresholdEditor: (props: unknown) => mockDynamicThresholdEditor(props),
}));

jest.mock('app/features/expressions/components/SqlExpressions/SqlExpr', () => ({
  SqlExpr: ({ onChange, query }: { onChange: (query: SqlExpressionQuery) => void; query: SqlExpressionQuery }) => (
    <div data-testid="sql-expression-editor">
      {query.expression}
      <button type="button" onClick={() => onChange({ ...query, expression: `${query.expression} -- edited` })}>
        edit SQL
      </button>
    </div>
  ),
}));

const emptyPolicy: DynamicThresholdPolicyV1 = {
  inputRefId: '',
  valueField: '',
  matchLabel: '',
  labelColumns: [],
  evaluator: EvalFunction.IsAbove,
  mappings: [],
  defaultThreshold: [],
};

const completePolicy: DynamicThresholdPolicyV1 = {
  inputRefId: 'A',
  valueField: 'value',
  matchLabel: 'region',
  labelColumns: ['region'],
  evaluator: EvalFunction.IsAbove,
  mappings: [{ labelValue: 'us-east', thresholds: [5] }],
  defaultThreshold: [10],
};

function makeSqlQuery(policy: DynamicThresholdPolicyV1 | undefined, expression: string): SqlExpressionQuery {
  return {
    refId: 'B',
    datasource: ExpressionDatasourceRef,
    type: ExpressionQueryType.sql,
    expression,
    format: 'alerting',
    ...(policy ? { dynamicThreshold: { version: 1 as const, policy } } : {}),
  };
}

function generatedSql(policy: DynamicThresholdPolicyV1): string {
  const built = buildDynamicThreshold(policy);
  if (!built.ok) {
    throw new Error('test policy must compile');
  }
  return built.expressionSql;
}

function renderExpression(initialQuery: SqlExpressionQuery, onChange = jest.fn()) {
  function TestExpression() {
    const form = useForm({ defaultValues: { type: 'grafana' } });
    const [query, setQuery] = useState<SqlExpressionQuery>(initialQuery);
    return (
      <FormProvider {...form}>
        <Expression
          query={query}
          queries={[]}
          onSetCondition={jest.fn()}
          onUpdateRefId={jest.fn()}
          onRemoveExpression={jest.fn()}
          onChangeQuery={(updated) => {
            onChange(updated);
            setQuery(updated as SqlExpressionQuery);
          }}
        />
      </FormProvider>
    );
  }
  render(<TestExpression />);
  return { onChange };
}

describe('Expression editor routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setTestFlags({ [FlagKeys.AlertingDynamicThresholdExpression]: true });
  });

  it('does not mount SqlExpr or seed placeholder SQL for new dynamic threshold metadata', async () => {
    const { onChange } = renderExpression(makeSqlQuery(emptyPolicy, ''));

    expect(await screen.findByTestId('dynamic-threshold-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('sql-expression-editor')).not.toBeInTheDocument();
    expect(screen.queryByText('Dynamic threshold settings discarded')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens the builder when the saved SQL matches the recompiled policy', async () => {
    const { onChange } = renderExpression(makeSqlQuery(completePolicy, generatedSql(completePolicy)));

    expect(await screen.findByTestId('dynamic-threshold-editor')).toBeInTheDocument();
    expect(screen.queryByText('Dynamic threshold settings discarded')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('warns, discards the policy from form state, and keeps the saved SQL when it differs from the recompiled policy', async () => {
    const savedSql = `${generatedSql(completePolicy)}\n-- hand edited`;
    const { onChange } = renderExpression(makeSqlQuery(completePolicy, savedSql));

    expect(await screen.findByText('Dynamic threshold settings discarded')).toBeInTheDocument();
    expect(screen.getByTestId('sql-expression-editor')).toHaveTextContent('-- hand edited');
    expect(screen.queryByTestId('dynamic-threshold-editor')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0];
    expect(updated.expression).toBe(savedSql);
    expect(updated).not.toHaveProperty('dynamicThreshold');
  });

  it('treats a policy that no longer compiles as a mismatch when SQL exists', async () => {
    const { onChange } = renderExpression(makeSqlQuery({ ...completePolicy, defaultThreshold: [] }, 'SELECT 1'));

    expect(await screen.findByText('Dynamic threshold settings discarded')).toBeInTheDocument();
    expect(screen.getByTestId('sql-expression-editor')).toHaveTextContent('SELECT 1');
    expect(onChange.mock.calls[0][0]).not.toHaveProperty('dynamicThreshold');
  });

  it('renders ordinary SQL expressions in SqlExpr without warnings or changes', async () => {
    const { onChange } = renderExpression(makeSqlQuery(undefined, 'SELECT * FROM A'));

    expect(await screen.findByTestId('sql-expression-editor')).toHaveTextContent('SELECT * FROM A');
    expect(screen.queryByText('Dynamic threshold settings discarded')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders metadata-backed SQL in SqlExpr with the SQL preserved when the feature flag is off', async () => {
    setTestFlags({ [FlagKeys.AlertingDynamicThresholdExpression]: false });
    const sql = generatedSql(completePolicy);
    const { onChange } = renderExpression(makeSqlQuery(completePolicy, sql));

    expect(await screen.findByTestId('sql-expression-editor')).toHaveTextContent('SELECT');
    expect(screen.queryByTestId('dynamic-threshold-editor')).not.toBeInTheDocument();
    expect(screen.queryByText('Dynamic threshold settings discarded')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'edit SQL' }));

    const updated = onChange.mock.calls[0][0];
    expect(updated.expression).toBe(`${sql} -- edited`);
    expect(updated).not.toHaveProperty('dynamicThreshold');
  });
});

describe('Expression header and description', () => {
  const dynamicThresholdDescription = 'Create an alert condition with thresholds that vary by label value.';

  beforeEach(() => {
    setTestFlags({ [FlagKeys.AlertingDynamicThresholdExpression]: true });
  });

  it('shows the dynamic threshold title and description in builder mode', async () => {
    renderExpression(makeSqlQuery(completePolicy, generatedSql(completePolicy)));

    expect(await screen.findByTestId('dynamic-threshold-editor')).toBeInTheDocument();
    expect(screen.getByText('Dynamic threshold')).toBeInTheDocument();
    expect(screen.getByText(dynamicThresholdDescription)).toBeInTheDocument();
    expect(screen.queryByText('SQL')).not.toBeInTheDocument();
  });

  it('shows SQL for plain SQL expressions', async () => {
    renderExpression(makeSqlQuery(undefined, 'SELECT * FROM A'));

    expect(await screen.findByTestId('sql-expression-editor')).toBeInTheDocument();
    expect(screen.getByText('SQL')).toBeInTheDocument();
    expect(screen.queryByText('Dynamic threshold')).not.toBeInTheDocument();
    expect(screen.queryByText(dynamicThresholdDescription)).not.toBeInTheDocument();
  });

  it('shows SQL when the saved SQL does not match the policy', async () => {
    renderExpression(makeSqlQuery(completePolicy, `${generatedSql(completePolicy)}\n-- hand edited`));

    expect(await screen.findByText('Dynamic threshold settings discarded')).toBeInTheDocument();
    expect(screen.getByText('SQL')).toBeInTheDocument();
    expect(screen.queryByText('Dynamic threshold')).not.toBeInTheDocument();
    expect(screen.queryByText(dynamicThresholdDescription)).not.toBeInTheDocument();
  });

  it('shows SQL when the feature flag is off', async () => {
    setTestFlags({ [FlagKeys.AlertingDynamicThresholdExpression]: false });
    renderExpression(makeSqlQuery(completePolicy, generatedSql(completePolicy)));

    expect(await screen.findByTestId('sql-expression-editor')).toBeInTheDocument();
    expect(screen.getByText('SQL')).toBeInTheDocument();
    expect(screen.queryByText('Dynamic threshold')).not.toBeInTheDocument();
    expect(screen.queryByText(dynamicThresholdDescription)).not.toBeInTheDocument();
  });
});

describe('TestResult', () => {
  it('should be able to render', () => {
    expect(() => {
      render(<ExpressionResult series={[]} />);
    }).not.toThrow();
  });

  it('should show labels and values', () => {
    const series: DataFrame[] = [
      toDataFrame({ fields: [{ name: 'temp', values: [0.1234], labels: { label1: 'value1', label2: 'value2' } }] }),
      toDataFrame({ fields: [{ name: 'temp', values: [0.5678], labels: { label1: 'value3', label2: 'value4' } }] }),
    ];
    render(<ExpressionResult series={series} />);

    expect(screen.getByTitle('{label1=value1, label2=value2}')).toBeInTheDocument();
    expect(screen.getByText('0.1234')).toBeInTheDocument();

    expect(screen.getByTitle('{label1=value3, label2=value4}')).toBeInTheDocument();
    expect(screen.getByText('0.5678')).toBeInTheDocument();
  });

  it('should not paginate with less than PAGE_SIZE', () => {
    const series: DataFrame[] = [
      toDataFrame({
        fields: [
          {
            name: 'temp',
            values: [23, 11, 10],
          },
        ],
      }),
    ];

    render(<ExpressionResult series={series} />);
    expect(screen.queryByTestId('paginate-expression')).not.toBeInTheDocument();
  });

  it('should paginate with greater than PAGE_SIZE', async () => {
    const series: DataFrame[] = makeSeries(50);

    render(<ExpressionResult series={series} />);
    expect(screen.getByTestId('paginate-expression')).toBeInTheDocument();
    expect(screen.getByText(`1 - 20 of ${50}`)).toBeInTheDocument();

    // click previous page
    await userEvent.click(screen.getByLabelText('previous-page'));
    expect(screen.getByText(`1 - 20 of ${50}`)).toBeInTheDocument();

    // keep clicking next page, should clamp
    await userEvent.click(screen.getByLabelText('next-page'));
    expect(screen.getByText(`21 - 40 of ${50}`)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('next-page'));
    expect(screen.getByText(`41 - 50 of ${50}`)).toBeInTheDocument();
    // click one more time, should still be on the last page
    await userEvent.click(screen.getByLabelText('next-page'));
    expect(screen.getByText(`41 - 50 of ${50}`)).toBeInTheDocument();
  });
});

function makeSeries(n: number) {
  return times(n, () =>
    toDataFrame({
      fields: [
        {
          name: 'temp',
          values: [0.1234],
          labels: {
            label1: 'value1',
            label2: 'value2',
          },
        },
      ],
    })
  );
}

describe('getGroupedByStateAndSeriesCount', () => {
  it('should group series by state correctly and count the number of series', () => {
    const series: DataFrame[] = [
      toDataFrame({ fields: [{ name: 'value', values: [1] }] }),
      toDataFrame({ fields: [{ name: 'value', values: [undefined] }] }),
      toDataFrame({ fields: [{ name: 'value', values: [0] }] }),
      toDataFrame({ fields: [{ name: 'value', values: [2] }] }),
      toDataFrame({ fields: [{ name: 'value', values: [undefined] }] }),
    ];

    const { groupedByState, seriesCount } = getGroupedByStateAndSeriesCount(series);

    expect(groupedByState.firing).toEqual([series[0], series[3]]);
    expect(groupedByState.inactive).toEqual([series[2]]);
    expect(seriesCount).toEqual(3);
  });

  it('should return empty group state and zero series count when input array is empty', () => {
    const series: DataFrame[] = [];

    const { groupedByState, seriesCount } = getGroupedByStateAndSeriesCount(series);

    expect(groupedByState).toEqual({
      firing: [],
      inactive: [],
    });
    expect(seriesCount).toEqual(0);
  });

  it('should return zero series count and empty group state when all series have undefined values', () => {
    const series = [
      toDataFrame({ fields: [{ name: 'value', values: [undefined] }] }),
      toDataFrame({ fields: [{ name: 'value', values: [undefined] }] }),
    ];

    const { groupedByState, seriesCount } = getGroupedByStateAndSeriesCount(series);

    expect(groupedByState.firing).toEqual([]);
    expect(groupedByState.inactive).toEqual([]);
    expect(seriesCount).toEqual(0);
  });

  it('should group all series by inactive state when all series have zero values', () => {
    const series = [
      toDataFrame({ fields: [{ name: 'value', values: [0] }] }),
      toDataFrame({ fields: [{ name: 'value', values: [0] }] }),
      toDataFrame({ fields: [{ name: 'value', values: [0] }] }),
    ];

    const { groupedByState, seriesCount } = getGroupedByStateAndSeriesCount(series);

    expect(groupedByState.firing).toEqual([]);
    expect(groupedByState.inactive).toEqual(series);
    expect(seriesCount).toEqual(series.length);
  });

  it('should group all series by Firing state when all series have non-zero values', () => {
    const series = [
      toDataFrame({ fields: [{ name: 'value', values: [1] }] }),
      toDataFrame({ fields: [{ name: 'value', values: [2] }] }),
      toDataFrame({ fields: [{ name: 'value', values: [3] }] }),
    ];

    const { groupedByState, seriesCount } = getGroupedByStateAndSeriesCount(series);

    expect(groupedByState.firing).toEqual(series);
    expect(groupedByState.inactive).toEqual([]);
    expect(seriesCount).toEqual(series.length);
  });
});

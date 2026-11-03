import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ExpressionDatasourceRef } from '@grafana/runtime/internal';

import { EvalFunction } from '../../../alerting/state/alertDef';
import { type DynamicThresholdPolicyV1, ExpressionQueryType, type SqlExpressionQuery } from '../../types';

import { DynamicThresholdEditor } from './DynamicThresholdEditor';

const mockSourcePreview = jest.fn();

jest.mock('./sourcePreview', () => ({
  getDynamicThresholdSourceOptions: (queries: Array<{ refId: string }>, selfRefId: string) =>
    queries.filter((query) => query.refId !== selfRefId).map((query) => ({ value: query.refId, label: query.refId })),
  useDynamicThresholdSourcePreview: (...args: unknown[]) => mockSourcePreview(...args),
}));

const sourceQuery = {
  refId: 'A',
  queryType: '',
  datasourceUid: 'prometheus',
  model: { refId: 'A', datasource: { uid: 'prometheus', type: 'prometheus' } },
};

function makeQuery(overrides: Partial<DynamicThresholdPolicyV1> = {}): SqlExpressionQuery {
  return {
    refId: 'B',
    datasource: ExpressionDatasourceRef,
    type: ExpressionQueryType.sql,
    expression: 'stale SQL',
    format: 'alerting',
    dynamicThreshold: {
      version: 1,
      policy: {
        inputRefId: 'A',
        valueField: 'value',
        matchLabel: 'region',
        labelColumns: ['region', 'cluster'],
        evaluator: EvalFunction.IsAbove,
        mappings: [{ labelValue: 'us-east', thresholds: [5] }],
        defaultThreshold: [10],
        ...overrides,
      },
    },
  };
}

beforeEach(() => {
  mockSourcePreview.mockReturnValue({
    numericFields: ['value'],
    stringFields: ['region', 'cluster'],
    labelValues: ['us-east', 'eu-west'],
    loading: false,
    error: null,
    hasSchema: true,
  });
});

describe('DynamicThresholdEditor', () => {
  it.each([
    {
      state: 'loading',
      preview: { loading: true, error: null, hasSchema: false, numericFields: [], stringFields: [], labelValues: [] },
      text: 'Loading source schema',
    },
    {
      state: 'error',
      preview: {
        loading: false,
        error: new Error('schema failed'),
        hasSchema: false,
        numericFields: [],
        stringFields: [],
        labelValues: [],
      },
      text: 'schema failed',
    },
    {
      state: 'no data',
      preview: { loading: false, error: null, hasSchema: true, numericFields: [], stringFields: [], labelValues: [] },
      text: 'No fields found',
    },
  ])('renders the schema $state state', ({ preview, text }) => {
    mockSourcePreview.mockReturnValue(preview);
    render(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={jest.fn()} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('auto-selects the only numeric field and requires selection when there are multiple fields', async () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <DynamicThresholdEditor query={makeQuery({ valueField: '' })} queries={[sourceQuery]} onChange={onChange} />
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dynamicThreshold: expect.objectContaining({
          policy: expect.objectContaining({ valueField: 'value' }),
        }),
      })
    );

    onChange.mockClear();
    mockSourcePreview.mockReturnValue({
      numericFields: ['value', 'peak'],
      stringFields: ['region'],
      labelValues: [],
      loading: false,
      error: null,
      hasSchema: true,
    });
    rerender(
      <DynamicThresholdEditor
        query={makeQuery({ valueField: '', labelColumns: ['region'] })}
        queries={[sourceQuery]}
        onChange={onChange}
      />
    );

    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('combobox', { name: 'Numeric field' }));
    expect(screen.getByText('value')).toBeInTheDocument();
    expect(screen.getByText('peak')).toBeInTheDocument();
  });

  it('atomically updates policy, generated SQL, alerting format, and label columns for a valid edit', () => {
    const onChange = jest.fn();
    render(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Default threshold' }), {
      target: { value: '12' },
    });

    const update = onChange.mock.calls.at(-1)?.[0];
    expect(update).toEqual(
      expect.objectContaining({
        expression: expect.stringContaining('WHEN `A`.`value` >'),
        format: 'alerting',
        dynamicThreshold: expect.objectContaining({
          policy: expect.objectContaining({ defaultThreshold: [12], labelColumns: ['region', 'cluster'] }),
        }),
      })
    );
  });

  it('clears stale SQL and places a structured field error when policy becomes invalid', () => {
    const onChange = jest.fn();
    render(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Default threshold' }), { target: { value: '' } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ expression: '' }));
    expect(onChange.mock.calls.at(-1)?.[0].dynamicThreshold.policy.defaultThreshold).toEqual([undefined]);
  });

  it('clears schema-dependent policy state when the input query changes', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const otherSourceQuery = {
      refId: 'C',
      queryType: '',
      datasourceUid: 'loki',
      model: { refId: 'C', datasource: { uid: 'loki', type: 'loki' } },
    };
    render(
      <DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery, otherSourceQuery]} onChange={onChange} />
    );

    await user.click(screen.getByRole('combobox', { name: 'Input query' }));
    await user.click(screen.getByText('C'));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expression: '',
        dynamicThreshold: expect.objectContaining({
          policy: expect.objectContaining({
            inputRefId: 'C',
            valueField: '',
            matchLabel: '',
            labelColumns: [],
            mappings: [],
            defaultThreshold: [],
          }),
        }),
      })
    );
  });

  it('does not rewrite a populated saved policy when schema loads or returns no data', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />
    );

    expect(onChange).not.toHaveBeenCalled();
    mockSourcePreview.mockReturnValue({
      numericFields: [],
      stringFields: [],
      labelValues: [],
      loading: false,
      error: null,
      hasSchema: true,
    });
    rerender(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <DynamicThresholdEditor
        query={makeQuery({ valueField: '', labelColumns: [] })}
        queries={[sourceQuery]}
        onChange={onChange}
      />
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('preserves positional range slots when either bound is cleared or entered first', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <DynamicThresholdEditor
        query={makeQuery({ evaluator: EvalFunction.IsWithinRange, defaultThreshold: [1, 2] })}
        queries={[sourceQuery]}
        onChange={onChange}
      />
    );

    const lower = screen.getByRole('spinbutton', { name: 'Default lower threshold' });
    const upper = screen.getByRole('spinbutton', { name: 'Default upper threshold' });
    await user.clear(lower);
    expect(onChange.mock.calls.at(-1)?.[0].dynamicThreshold.policy.defaultThreshold).toEqual([undefined, 2]);

    fireEvent.change(upper, { target: { value: '' } });
    fireEvent.change(upper, { target: { value: '9' } });
    expect(onChange.mock.calls.at(-1)?.[0].dynamicThreshold.policy.defaultThreshold).toEqual([1, 9]);
  });

  it('resizes threshold slots only when operator arity changes', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const { rerender } = render(
      <DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />
    );

    await user.click(screen.getByRole('combobox', { name: 'Operator' }));
    await user.click(screen.getByText('Is within range'));
    expect(onChange.mock.calls.at(-1)?.[0].dynamicThreshold.policy.defaultThreshold).toEqual([10, undefined]);
    expect(onChange.mock.calls.at(-1)?.[0].dynamicThreshold.policy.mappings[0].thresholds).toEqual([5, undefined]);

    rerender(
      <DynamicThresholdEditor
        query={makeQuery({
          evaluator: EvalFunction.IsWithinRange,
          defaultThreshold: [10, 20],
          mappings: [{ labelValue: 'us-east', thresholds: [5, 15] }],
        })}
        queries={[sourceQuery]}
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole('combobox', { name: 'Operator' }));
    await user.click(screen.getByText('Is above'));
    expect(onChange.mock.calls.at(-1)?.[0].dynamicThreshold.policy.defaultThreshold).toEqual([10]);
    expect(onChange.mock.calls.at(-1)?.[0].dynamicThreshold.policy.mappings[0].thresholds).toEqual([5]);
  });

  it('keeps mappings unchanged when preview suggestions refresh', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />
    );
    mockSourcePreview.mockReturnValue({
      numericFields: ['value'],
      stringFields: ['region', 'cluster'],
      labelValues: ['new-suggestion'],
      loading: false,
      error: null,
      hasSchema: true,
    });
    rerender(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('selecting the current match label is a no-op', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Match label' }));
    await user.click(screen.getAllByText('region').at(-1)!);

    expect(screen.queryByText('Change match label?')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('requires confirmation before changing labels and cancel preserves policy', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Match label' }));
    await user.click(screen.getByText('cluster'));
    expect(screen.getByText('Change match label?')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('combobox', { name: 'Match label' }));
    await user.click(screen.getByText('cluster'));
    await user.click(screen.getByRole('button', { name: 'Change label' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expression: '',
        dynamicThreshold: expect.objectContaining({
          policy: expect.objectContaining({ matchLabel: 'cluster', mappings: [], defaultThreshold: [] }),
        }),
      })
    );
  });
});

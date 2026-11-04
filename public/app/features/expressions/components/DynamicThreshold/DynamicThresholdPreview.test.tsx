import { act, render, screen } from '@testing-library/react';

import { type DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';

import { EvalFunction } from '../../../alerting/state/alertDef';
import { dataSource } from '../../ExpressionDatasource';
import { type DynamicThresholdPolicyV1 } from '../../types';

import { DynamicThresholdPreview } from './DynamicThresholdPreview';

jest.mock('../../utils/interpolateSourceQueries', () => ({
  interpolateSourceQueries: (queries: unknown[]) => Promise.resolve(queries),
}));
jest.mock('app/core/services/backend_srv', () => ({ backendSrv: { resolveCancelerIfExists: jest.fn() } }));

const runMetaSQLExprQuery = jest.spyOn(dataSource, 'runMetaSQLExprQuery');

const queries = [
  {
    refId: 'A',
    queryType: '',
    datasourceUid: 'prometheus',
    relativeTimeRange: { from: 600, to: 0 },
    model: { refId: 'A', datasource: { uid: 'prometheus', type: 'prometheus' } },
  },
];

const policy: DynamicThresholdPolicyV1 = {
  inputRefId: 'A',
  valueField: 'value',
  matchLabel: 'region',
  labelColumns: ['region', 'cluster'],
  evaluator: EvalFunction.IsAbove,
  mappings: [],
  defaultThreshold: [10],
};

function scalarFrame(): DataFrame {
  return toDataFrame({
    fields: [
      { name: 'region', type: FieldType.string, values: ['us-east', 'eu-west'] },
      { name: 'cluster', type: FieldType.string, values: ['c1', 'c2'] },
      { name: 'current_value', type: FieldType.number, values: [12, 3] },
      { name: 'matched_threshold', type: FieldType.number, values: [5, 10] },
      { name: 'condition_result', type: FieldType.number, values: [1, 0] },
    ],
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DynamicThresholdPreview', () => {
  it('shows a loading state, then label columns, value, matched threshold, and condition result', async () => {
    const pending = deferred<DataFrame>();
    runMetaSQLExprQuery.mockReturnValue(pending.promise);
    render(<DynamicThresholdPreview queries={queries} policy={policy} previewSql="SELECT 1" />);

    expect(await screen.findByText('Loading preview')).toBeInTheDocument();

    await act(async () => pending.resolve(scalarFrame()));

    expect(screen.queryByText('Loading preview')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'region' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'cluster' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Matched threshold' })).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('us-eastc1125True');
    expect(rows[2]).toHaveTextContent('eu-westc2310False');
  });

  it('shows matched lower and upper bounds for range operators', async () => {
    runMetaSQLExprQuery.mockResolvedValue(
      toDataFrame({
        fields: [
          { name: 'region', type: FieldType.string, values: ['us-east'] },
          { name: 'cluster', type: FieldType.string, values: ['c1'] },
          { name: 'current_value', type: FieldType.number, values: [7] },
          { name: 'matched_threshold_lower', type: FieldType.number, values: [1] },
          { name: 'matched_threshold_upper', type: FieldType.number, values: [5] },
          { name: 'condition_result', type: FieldType.number, values: [1] },
        ],
      })
    );
    render(<DynamicThresholdPreview queries={queries} policy={policy} previewSql="SELECT 1" />);

    expect(await screen.findByRole('columnheader', { name: 'Matched range' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('us-eastc171 – 5True');
  });

  it('shows an error state', async () => {
    runMetaSQLExprQuery.mockRejectedValue(new Error('query length exceeded'));
    render(<DynamicThresholdPreview queries={queries} policy={policy} previewSql="SELECT 1" />);

    expect(await screen.findByText('Unable to load policy preview')).toBeInTheDocument();
    expect(screen.getByText('query length exceeded')).toBeInTheDocument();
  });

  it('shows an empty state when the input returns no rows', async () => {
    runMetaSQLExprQuery.mockResolvedValue(toDataFrame({ fields: [] }));
    render(<DynamicThresholdPreview queries={queries} policy={policy} previewSql="SELECT 1" />);

    expect(await screen.findByText('The input query returned no data.')).toBeInTheDocument();
  });

  it('uses the source query time range and a unique request ID for each request', async () => {
    runMetaSQLExprQuery.mockResolvedValue(scalarFrame());
    const { rerender } = render(<DynamicThresholdPreview queries={queries} policy={policy} previewSql="SELECT 1" />);
    await screen.findAllByRole('row');
    rerender(<DynamicThresholdPreview queries={queries} policy={policy} previewSql="SELECT 2" />);
    await screen.findAllByRole('row');

    const [firstRequest, firstRange, firstQueries] = runMetaSQLExprQuery.mock.calls[0];
    const [secondRequest] = runMetaSQLExprQuery.mock.calls[1];
    expect(firstRequest.rawSql).toBe('SELECT 1');
    expect(secondRequest.rawSql).toBe('SELECT 2');
    expect(firstRequest.refId).toMatch(/^dynamic-threshold-preview-/);
    expect(firstRequest.refId).not.toBe(secondRequest.refId);
    expect(firstRange.to.valueOf() - firstRange.from.valueOf()).toBe(600_000);
    expect(firstQueries).toEqual([queries[0].model]);
  });

  it('cancels the in-flight request and ignores its stale response when the SQL changes', async () => {
    const first = deferred<DataFrame>();
    const second = deferred<DataFrame>();
    runMetaSQLExprQuery.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { rerender } = render(<DynamicThresholdPreview queries={queries} policy={policy} previewSql="SELECT 1" />);
    await screen.findByText('Loading preview');
    const firstRefId = runMetaSQLExprQuery.mock.calls[0][0].refId;

    rerender(<DynamicThresholdPreview queries={queries} policy={policy} previewSql="SELECT 2" />);
    expect(backendSrv.resolveCancelerIfExists).toHaveBeenCalledWith(firstRefId);

    await act(async () =>
      second.resolve(
        toDataFrame({
          fields: [
            { name: 'region', type: FieldType.string, values: ['second'] },
            { name: 'cluster', type: FieldType.string, values: ['c'] },
            { name: 'current_value', type: FieldType.number, values: [1] },
            { name: 'matched_threshold', type: FieldType.number, values: [2] },
            { name: 'condition_result', type: FieldType.number, values: [0] },
          ],
        })
      )
    );
    await act(async () => first.resolve(scalarFrame()));

    expect(screen.getByText('second')).toBeInTheDocument();
    expect(screen.queryByText('us-east')).not.toBeInTheDocument();
  });

  it('does not show the previous result while a new request is loading', async () => {
    const next = deferred<DataFrame>();
    runMetaSQLExprQuery.mockResolvedValueOnce(scalarFrame()).mockReturnValueOnce(next.promise);
    const { rerender } = render(<DynamicThresholdPreview queries={queries} policy={policy} previewSql="SELECT 1" />);
    expect(await screen.findByText('us-east')).toBeInTheDocument();

    rerender(<DynamicThresholdPreview queries={queries} policy={policy} previewSql="SELECT 2" />);

    expect(screen.queryByText('us-east')).not.toBeInTheDocument();
    expect(screen.getByText('Loading preview')).toBeInTheDocument();
  });

  it('renders nothing when the input query is missing', () => {
    const { container } = render(<DynamicThresholdPreview queries={[]} policy={policy} previewSql="SELECT 1" />);

    expect(container).toBeEmptyDOMElement();
    expect(runMetaSQLExprQuery).not.toHaveBeenCalled();
  });
});

import { type DataQueryRequest, type DataQueryResponse, type Field, FieldType, toDataFrame } from '@grafana/data';
import { transformV2 } from '@grafana/prometheus';

import { type CloudWatchMetricsQuery, MetricEditorMode, MetricQueryType } from '../dataquery.gen';
import { type CloudWatchQuery } from '../types';

import { applyPromQLTransform } from './CloudWatchMetricsQueryRunner';

// transformV2 is exercised heavily by @grafana/prometheus itself; here we stub it to an
// identity so the tests assert the CloudWatch-specific behaviour of applyPromQLTransform
// (frame partitioning and legend handling) rather than the upstream transform.
jest.mock('@grafana/prometheus', () => ({
  transformV2: jest.fn((response) => response),
}));

function promqlTarget(overrides: Partial<CloudWatchMetricsQuery> = {}): CloudWatchMetricsQuery {
  return {
    id: '',
    queryMode: 'Metrics',
    refId: 'A',
    region: 'us-east-1',
    metricQueryType: MetricQueryType.PromQL,
    metricEditorMode: MetricEditorMode.Code,
    namespace: '',
    promqlExpression: 'up',
    ...overrides,
  };
}

function makeRequest(targets: CloudWatchMetricsQuery[]): DataQueryRequest<CloudWatchQuery> {
  return { targets } as DataQueryRequest<CloudWatchQuery>;
}

beforeEach(() => {
  (transformV2 as jest.Mock).mockClear();
});

describe('applyPromQLTransform', () => {
  it('returns the response untouched when there are no PromQL targets', () => {
    const searchTarget = promqlTarget({ metricQueryType: MetricQueryType.Search });
    const response: DataQueryResponse = { data: [toDataFrame({ refId: 'A', fields: [] })] };

    const result = applyPromQLTransform(response, makeRequest([searchTarget]));

    expect(result).toBe(response);
    expect(transformV2).not.toHaveBeenCalled();
  });

  it('routes PromQL frames through transformV2 and leaves non-PromQL frames untouched', () => {
    const promFrame = toDataFrame({ refId: 'A', fields: [{ name: 'Value', type: FieldType.number, values: [1] }] });
    const searchFrame = toDataFrame({ refId: 'B', fields: [{ name: 'Value', type: FieldType.number, values: [2] }] });
    const response: DataQueryResponse = { data: [promFrame, searchFrame] };

    const request = makeRequest([
      promqlTarget({ refId: 'A' }),
      promqlTarget({ refId: 'B', metricQueryType: MetricQueryType.Search }),
    ]);
    const result = applyPromQLTransform(response, request);

    expect(transformV2).toHaveBeenCalledTimes(1);
    const [transformArg] = (transformV2 as jest.Mock).mock.calls[0];
    expect(transformArg.data).toEqual([promFrame]);

    expect(result.data).toContain(searchFrame);
    expect(result.data).toContain(promFrame);
  });

  it('applies a custom legendFormat as displayNameFromDS on PromQL number fields', () => {
    const promFrame = toDataFrame({
      refId: 'A',
      fields: [{ name: 'Value', type: FieldType.number, values: [1], labels: { instance: 'host-a' } }],
    });
    const response: DataQueryResponse = { data: [promFrame] };

    const result = applyPromQLTransform(
      response,
      makeRequest([promqlTarget({ refId: 'A', legendFormat: '{{instance}}' })])
    );

    const numberField = result.data[0].fields.find((f: Field) => f.type === FieldType.number);
    expect(numberField?.config.displayNameFromDS).toEqual('host-a');
  });

  it('does not set displayNameFromDS when legendFormat is unset or __auto', () => {
    const makeFrame = () =>
      toDataFrame({
        refId: 'A',
        fields: [{ name: 'Value', type: FieldType.number, values: [1], labels: { instance: 'host-a' } }],
      });

    for (const legendFormat of [undefined, '__auto']) {
      const frame = makeFrame();
      const result = applyPromQLTransform({ data: [frame] }, makeRequest([promqlTarget({ refId: 'A', legendFormat })]));
      const numberField = result.data[0].fields.find((f: Field) => f.type === FieldType.number);
      expect(numberField?.config.displayNameFromDS).toBeUndefined();
    }
  });
});

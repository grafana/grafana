import { firstValueFrom, of } from 'rxjs';

import {
  type DataFrame,
  type DataQueryRequest,
  FieldType,
  NodeGraphDataFrameFieldNames as Fields,
  toDataFrame,
} from '@grafana/data';

import { type TempoQuery } from './types';
import { createTempoDatasource } from './test/mocks';

function makeRequest(query: Partial<TempoQuery>): DataQueryRequest<TempoQuery> {
  return {
    targets: [{ refId: 'A', queryType: 'flow', ...query } as TempoQuery],
    scopedVars: {},
  } as unknown as DataQueryRequest<TempoQuery>;
}

describe('TempoDatasource flow table branch', () => {
  it('routes a flow table query through handleTraceQlQuery with the composed filter', () => {
    const ds = createTempoDatasource();
    const spy = jest
      .spyOn(ds, 'handleTraceQlQuery')
      .mockReturnValue(of({ data: [] }));

    ds.query(makeRequest({ flowView: 'table', flowFilters: [{ key: 'direction', values: ['egress'] }] }));

    expect(spy).toHaveBeenCalledTimes(1);
    const passedTargets = spy.mock.calls[0][1].traceql;
    expect(passedTargets[0].query).toBe('{ span.flow.direction = "egress" }');
    expect(passedTargets[0].tableType).toBe('spans');
  });
});

function groupedFrame(host: string, dest: string, value: number) {
  return toDataFrame({
    refId: 'A',
    fields: [
      { name: 'Time', type: FieldType.time, values: [0] },
      {
        name: 'value',
        type: FieldType.number,
        values: [value],
        labels: { 'resource.service.name': host, 'span.destination.address': dest },
      },
    ],
  });
}

describe('TempoDatasource flow topology branch', () => {
  it('calls handleTraceQlMetricsQuery twice and returns node/edge frames', async () => {
    const ds = createTempoDatasource();

    const countFrame = groupedFrame('web-1', '1.2.3.4', 7);
    const bytesFrame = groupedFrame('web-1', '1.2.3.4', 2048);

    const metricsSpy = jest
      .spyOn(ds, 'handleTraceQlMetricsQuery')
      .mockReturnValueOnce(of({ data: [countFrame] }))
      .mockReturnValueOnce(of({ data: [bytesFrame] }));

    const result = await firstValueFrom(
      ds.handleFlowTopologyQuery(
        makeRequest({ flowView: 'topology', flowFilters: [] }),
        []
      )
    );

    expect(metricsSpy).toHaveBeenCalledTimes(2);

    // Should return 2 frames: nodes and edges
    expect(result.data).toHaveLength(2);

    const nodeFrame = result.data.find((f: { name?: string }) => f.name === 'Nodes');
    const edgeFrame = result.data.find((f: { name?: string }) => f.name === 'Edges');
    expect(nodeFrame).toBeDefined();
    expect(edgeFrame).toBeDefined();

    // Both should have nodeGraph viz preference
    expect(nodeFrame!.meta?.preferredVisualisationType).toBe('nodeGraph');
    expect(edgeFrame!.meta?.preferredVisualisationType).toBe('nodeGraph');

    // The edge's mainStat should carry the joined count value.
    const mainStat = fieldValues(edgeFrame!, Fields.mainStat);
    expect(mainStat).toEqual([7]);
  });
});

function fieldValues(frame: DataFrame, name: string): unknown[] {
  const f = frame.fields.find((x) => x.name === name)!;
  return f.values.toArray ? f.values.toArray() : (f.values as unknown as unknown[]);
}

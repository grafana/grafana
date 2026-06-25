import { firstValueFrom, of } from 'rxjs';

import {
  type DataFrame,
  type DataQueryRequest,
  FieldType,
  NodeGraphDataFrameFieldNames as Fields,
  toDataFrame,
} from '@grafana/data';

import { createTempoDatasource } from './test/mocks';
import { type TempoQuery } from './types';

function makeRequest(query: Partial<TempoQuery>): DataQueryRequest<TempoQuery> {
  return {
    targets: [{ refId: 'A', queryType: 'flow', ...query } as TempoQuery],
    scopedVars: {},
  } as unknown as DataQueryRequest<TempoQuery>;
}

describe('TempoDatasource flow table branch', () => {
  it('flow main query is a no-op — results render in-component, not via Explore', async () => {
    const ds = createTempoDatasource();
    const tableSpy = jest.spyOn(ds, 'handleFlowTableQuery');
    const topoSpy = jest.spyOn(ds, 'handleFlowTopologyQuery');
    const searchSpy = jest.spyOn(ds, 'handleTraceQlQuery');

    const result = await firstValueFrom(
      ds.query(makeRequest({ flowView: 'table', flowFilters: [{ key: 'direction', values: ['egress'] }] }))
    );

    expect(result.data).toEqual([]);
    expect(tableSpy).not.toHaveBeenCalled();
    expect(topoSpy).not.toHaveBeenCalled();
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it('handleFlowTableQuery builds a table frame from count + bytes metrics', async () => {
    const ds = createTempoDatasource();
    jest
      .spyOn(ds, 'handleTraceQlMetricsQuery')
      .mockReturnValueOnce(of({ data: [tupleFrame('web-1', 'curl', '1.2.3.4', '443', 'tcp', 9)] }))
      .mockReturnValueOnce(of({ data: [tupleFrame('web-1', 'curl', '1.2.3.4', '443', 'tcp', 4096)] }));

    const result = await firstValueFrom(ds.handleFlowTableQuery(makeRequest({ flowView: 'table' }), []));

    expect(result.data).toHaveLength(1);
    const frame = result.data[0];
    expect(frame.meta?.preferredVisualisationType).toBe('table');
    expect(fieldValues(frame, 'Host')).toEqual(['web-1']);
    expect(fieldValues(frame, 'Destination')).toEqual(['1.2.3.4']);
    expect(fieldValues(frame, 'Flows')).toEqual([9]);
    expect(fieldValues(frame, 'Bytes')).toEqual([4096]);
  });
});

function tupleFrame(host: string, proc: string, dest: string, port: string, transport: string, value: number) {
  return toDataFrame({
    refId: 'A',
    fields: [
      { name: 'Time', type: FieldType.time, values: [0] },
      {
        name: 'value',
        type: FieldType.number,
        values: [value],
        labels: {
          'resource.service.name': host,
          'span.process.executable.name': proc,
          'span.destination.address': dest,
          'span.destination.port': port,
          'span.network.transport': transport,
        },
      },
    ],
  });
}

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

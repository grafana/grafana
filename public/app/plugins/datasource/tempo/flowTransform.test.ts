import { type DataFrame, FieldType, NodeGraphDataFrameFieldNames as Fields, toDataFrame } from '@grafana/data';

import { extractDestCountry, extractFlowEdges, flowEdgesToNodeGraph, flowSeriesToTable } from './flowTransform';

function tuple5(host: string, proc: string, dest: string, port: string, transport: string, value: number): DataFrame {
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

function fields(frame: DataFrame): string[] {
  return frame.fields.map((f) => f.name);
}

describe('flowSeriesToTable + extractDestCountry', () => {
  it('joins a Country column after Destination from the dest->country map', () => {
    const count = [tuple5('web-1', 'curl', '1.2.3.4', '443', 'tcp', 9)];
    const bytes = [tuple5('web-1', 'curl', '1.2.3.4', '443', 'tcp', 4096)];
    const countryFrame = toDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [0] },
        {
          name: 'value',
          type: FieldType.number,
          values: [9],
          labels: { 'span.destination.address': '"1.2.3.4"', 'span.destination.geo.country.iso_code': '"US"' },
        },
      ],
    });

    const countryByDest = extractDestCountry([countryFrame]);
    expect(countryByDest.get('1.2.3.4')).toBe('US');

    const frame = flowSeriesToTable(count, bytes, countryByDest);
    expect(fields(frame)).toEqual(['Host', 'Process', 'Destination', 'Country', 'Port', 'Transport', 'Flows', 'Bytes']);
    const countryCol = frame.fields.find((f) => f.name === 'Country')!;
    expect((countryCol.values.toArray ? countryCol.values.toArray() : countryCol.values)[0]).toBe('US');
  });

  it('omits the Country column when no map is given', () => {
    const frame = flowSeriesToTable([tuple5('web-1', 'curl', '1.2.3.4', '443', 'tcp', 9)], []);
    expect(fields(frame)).not.toContain('Country');
  });
});

function groupedFrame(host: string, dest: string, value: number): DataFrame {
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

function fieldValues(frame: DataFrame, name: string): unknown[] {
  const f = frame.fields.find((x) => x.name === name)!;
  return f.values.toArray ? f.values.toArray() : (f.values as unknown as unknown[]);
}

describe('extractFlowEdges', () => {
  it('joins count and bytes frames by host+destination', () => {
    const counts = [groupedFrame('web-1', '1.2.3.4', 12), groupedFrame('web-1', '5.6.7.8', 3)];
    const bytes = [groupedFrame('web-1', '1.2.3.4', 4096)];

    const edges = extractFlowEdges(counts, bytes);

    expect(edges).toEqual([
      { host: 'web-1', destination: '1.2.3.4', count: 12, bytes: 4096 },
      { host: 'web-1', destination: '5.6.7.8', count: 3, bytes: 0 },
    ]);
  });
});

describe('flowEdgesToNodeGraph', () => {
  it('builds node and edge frames with nodeGraph viz preference', () => {
    const { nodes, edges } = flowEdgesToNodeGraph([
      { host: 'web-1', destination: '1.2.3.4', count: 12, bytes: 4096 },
    ]);

    expect(nodes.meta?.preferredVisualisationType).toBe('nodeGraph');
    expect(edges.meta?.preferredVisualisationType).toBe('nodeGraph');

    expect(fieldValues(nodes, Fields.id)).toEqual(['host:web-1', 'dest:1.2.3.4']);
    expect(fieldValues(edges, Fields.source)).toEqual(['host:web-1']);
    expect(fieldValues(edges, Fields.target)).toEqual(['dest:1.2.3.4']);
    expect(fieldValues(edges, Fields.mainStat)).toEqual([12]);
    expect(fieldValues(edges, Fields.secondaryStat)).toEqual([4096]);
  });

  it('returns empty frames for no edges', () => {
    const { nodes, edges } = flowEdgesToNodeGraph([]);
    expect(fieldValues(nodes, Fields.id)).toEqual([]);
    expect(fieldValues(edges, Fields.id)).toEqual([]);
  });
});

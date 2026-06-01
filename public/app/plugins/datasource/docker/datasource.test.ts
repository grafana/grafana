import { FieldType, toDataFrame, type DataQueryRequest, dateTime } from '@grafana/data';

import DockerDatasource from './datasource';
import type { DockerQuery } from './types';

function createDS(): DockerDatasource {
  const args = {
    url: 'http://localhost',
    name: 'docker',
    withCredentials: false,
    basicAuth: '',
    jsonData: {},
    uid: 'test-uid',
    type: 'docker',
    readOnly: false,
    access: 'proxy',
    id: 1,
    orgId: 1,
  };
  // @ts-expect-error - Constructor expects DataSourceInstanceSettings but we're providing a minimal mock for testing
  return new DockerDatasource(args);
}

describe('DockerDatasource (safe tests)', () => {
  const ds = createDS();

  it('returns empty when no targets', (done) => {
    const emptyRequest: DataQueryRequest<DockerQuery> = {
      targets: [],
      requestId: 'test',
      interval: '',
      intervalMs: 0,
      range: {
        from: dateTime(0),
        to: dateTime(1000),
        raw: { from: 'now-1h', to: 'now' },
      },
      scopedVars: {},
      startTime: 0,
      timezone: 'browser',
      app: 'test',
    };

    ds.query(emptyRequest).subscribe((res) => {
      expect(res.data).toEqual([]);
      done();
    });
  });

  it('mergeFrames merges times correctly', () => {
    const a = toDataFrame({
      name: 'cpu',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        { name: 'value', type: FieldType.number, values: [10, 20] },
      ],
    });

    const b = toDataFrame({
      name: 'cpu',
      fields: [
        { name: 'time', type: FieldType.time, values: [2000, 3000] },
        { name: 'value', type: FieldType.number, values: [30, 40] },
      ],
    });

    // @ts-expect-error - Accessing private method for testing
    const result = ds.mergeFrames(a, b);

    const timeField = result.fields.find((f: { name: string }) => f.name === 'time');
    expect(timeField).toBeDefined();
    expect(timeField!.values).toContain(1000);
    expect(timeField!.values).toContain(3000);
  });

  it('trimFrame limits to MAX_POINTS', () => {
    const frame = toDataFrame({
      name: 'cpu',
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: Array.from({ length: 600 }, (_, i) => i),
        },
        {
          name: 'value',
          type: FieldType.number,
          values: Array.from({ length: 600 }, (_, i) => i),
        },
      ],
    });

    // @ts-expect-error - Accessing private method for testing
    const trimmed = ds.trimFrame(frame);

    expect(trimmed.fields[0].values.length).toBe(500);
  });
});

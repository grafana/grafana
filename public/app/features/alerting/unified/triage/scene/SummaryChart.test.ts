import { firstValueFrom, of } from 'rxjs';

import { type DataFrame, FieldType } from '@grafana/data';

import { collapseByAlertstateTransformation } from './SummaryChart';

function makeFrame(alertstate: string, folder: string, values: number[]): DataFrame {
  return {
    name: alertstate,
    refId: 'query',
    length: values.length,
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: values.map((_, i) => 1_000_000 + i * 30_000),
      },
      {
        name: 'Value',
        type: FieldType.number,
        config: { displayNameFromDS: alertstate },
        labels: { alertstate, grafana_folder: folder },
        values,
      },
    ],
  };
}

async function applyTransformation(frames: DataFrame[]): Promise<DataFrame[]> {
  const operator = collapseByAlertstateTransformation({} as never);
  return firstValueFrom(operator(of(frames)));
}

describe('collapseByAlertstateTransformation', () => {
  it('passes through frames unchanged when each alertstate appears only once', async () => {
    const firing = makeFrame('firing', '', [3, 5, 2]);
    const pending = makeFrame('pending', '', [1, 0, 2]);

    const result = await applyTransformation([firing, pending]);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(firing);
    expect(result[1]).toBe(pending);
  });

  it('sums values of frames with the same alertstate (e.g. from injected groupByKeys)', async () => {
    // Simulates what happens when groupByKeys=["grafana_folder"] is injected:
    // count by (alertstate) → count by (alertstate, grafana_folder), yielding one frame per folder.
    const firingFolder1 = makeFrame('firing', 'folder1', [3, 5, 2]);
    const firingFolder2 = makeFrame('firing', 'folder2', [1, 2, 4]);
    const pendingFolder1 = makeFrame('pending', 'folder1', [0, 1, 0]);

    const result = await applyTransformation([firingFolder1, firingFolder2, pendingFolder1]);

    expect(result).toHaveLength(2);

    const firingResult = result.find((f) => f.fields[1].labels?.alertstate === 'firing');
    const pendingResult = result.find((f) => f.fields[1].labels?.alertstate === 'pending');

    expect(firingResult?.fields[1].values).toEqual([4, 7, 6]);
    expect(pendingResult?.fields[1].values).toEqual([0, 1, 0]);
  });

  it('correctly sums frames with non-overlapping or offset time windows', async () => {
    // Reflects real Prometheus behaviour: each per-folder frame only contains timestamps
    // where that series was active, so frames start/end at different times.
    const ts = (offset: number) => 1_778_237_070_000 + offset * 15_000;

    // folder A: active from ts(0) (3 points)
    const folderA: DataFrame = {
      name: 'firing',
      refId: 'query',
      length: 3,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [ts(0), ts(1), ts(2)] },
        {
          name: 'Value',
          type: FieldType.number,
          config: {},
          labels: { alertstate: 'firing', grafana_folder: 'a' },
          values: [13, 13, 13],
        },
      ],
    };
    // folder B: active from ts(6), non-overlapping with A (A ends at ts(2))
    const folderB: DataFrame = {
      name: 'firing',
      refId: 'query',
      length: 9,
      fields: [
        {
          name: 'Time',
          type: FieldType.time,
          config: {},
          values: [ts(6), ts(7), ts(8), ts(9), ts(10), ts(11), ts(12), ts(13), ts(14)],
        },
        {
          name: 'Value',
          type: FieldType.number,
          config: {},
          labels: { alertstate: 'firing', grafana_folder: 'b' },
          values: [1, 1, 1, 1, 1, 1, 1, 1, 1],
        },
      ],
    };
    // folder C: overlaps with B at ts(9)..ts(14)
    const folderC: DataFrame = {
      name: 'firing',
      refId: 'query',
      length: 6,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [ts(9), ts(10), ts(11), ts(12), ts(13), ts(14)] },
        {
          name: 'Value',
          type: FieldType.number,
          config: {},
          labels: { alertstate: 'firing', grafana_folder: 'c' },
          values: [5, 5, 5, 5, 5, 5],
        },
      ],
    };

    const result = await applyTransformation([folderA, folderB, folderC]);

    expect(result).toHaveLength(1);
    const merged = result[0];
    // ts(0)..ts(2): A only (13), ts(6)..ts(8): B only (1), ts(9)..ts(14): B+C (1+5=6)
    expect(merged.fields[0].values).toEqual([
      ts(0),
      ts(1),
      ts(2),
      ts(6),
      ts(7),
      ts(8),
      ts(9),
      ts(10),
      ts(11),
      ts(12),
      ts(13),
      ts(14),
    ]);
    expect(merged.fields[1].values).toEqual([13, 13, 13, 1, 1, 1, 6, 6, 6, 6, 6, 6]);
    expect(merged.length).toBe(12);
  });

  it('handles an empty frames array', async () => {
    const result = await applyTransformation([]);
    expect(result).toEqual([]);
  });

  it('passes through a frame without an alertstate label unchanged', async () => {
    const noLabelFrame: DataFrame = {
      name: 'other',
      refId: 'query',
      length: 1,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [1_000_000] },
        { name: 'Value', type: FieldType.number, config: {}, labels: {}, values: [1] },
      ],
    };
    // Single frame with no alertstate label — it's a one-element group, returned as-is.
    const result = await applyTransformation([noLabelFrame]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(noLabelFrame);
  });

  it('passes through frames with no number field unchanged', async () => {
    const badFrame: DataFrame = {
      name: 'bad',
      refId: 'query',
      length: 1,
      fields: [{ name: 'alertstate', type: FieldType.string, config: {}, values: ['firing'] }],
    };
    // No number field → falls back to returning first frame.
    const result = await applyTransformation([badFrame, { ...badFrame }]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(badFrame);
  });

  it('preserves frame metadata (name, refId, meta) from the first frame in the group', async () => {
    const f1 = makeFrame('firing', 'folder1', [2, 4]);
    const f2 = makeFrame('firing', 'folder2', [1, 3]);

    const result = await applyTransformation([f1, f2]);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe(f1.name);
    expect(result[0].refId).toBe(f1.refId);
  });

  it('handles multiple groupBy dimensions simultaneously', async () => {
    // e.g. groupByKeys=["grafana_folder", "team"]
    const frames = [
      makeFrame('firing', 'folder-a', [1, 2]),
      makeFrame('firing', 'folder-b', [3, 4]),
      makeFrame('firing', 'folder-c', [5, 6]),
      makeFrame('pending', 'folder-a', [0, 1]),
    ];

    const result = await applyTransformation(frames);

    expect(result).toHaveLength(2);
    const firing = result.find((f) => f.fields[1].labels?.alertstate === 'firing');
    expect(firing?.fields[1].values).toEqual([9, 12]);
  });
});

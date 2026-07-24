import {
  createDataFrame,
  type DataFrame,
  dateTime,
  type DisplayProcessor,
  FieldType,
  type InterpolateFunction,
  type TimeRange,
} from '@grafana/data';

import { buildDatapointAssistantContext } from './buildAssistantContext';

jest.mock('@grafana/assistant', () => ({
  createAssistantContextItem: jest.fn((type, params) => ({ type, params })),
}));

// Fixed, plausibly-recent timestamps so the assertions read like real data.
const POINT_1_MS = Date.UTC(2026, 6, 24, 12, 0, 0);
const POINT_2_MS = Date.UTC(2026, 6, 24, 12, 1, 0);
const POINT_2_ISO = new Date(POINT_2_MS).toISOString();

const passthroughDisplay: DisplayProcessor = (v) => ({ text: String(v), numeric: Number(v) });

const noopReplace: InterpolateFunction = (s) => s;

function makeTimeRange(): TimeRange {
  return {
    from: dateTime(POINT_1_MS),
    to: dateTime(POINT_2_MS),
    raw: { from: 'now-1h', to: 'now' },
  };
}

/** An aligned frame with a time x-field and a single numeric series. */
function makeAlignedFrame(overrides: Partial<{ refId: string; executedQueryString: string }> = {}): DataFrame {
  const frame = createDataFrame({
    refId: overrides.refId ?? 'A',
    meta: overrides.executedQueryString ? { executedQueryString: overrides.executedQueryString } : undefined,
    fields: [
      { name: 'time', type: FieldType.time, values: [POINT_1_MS, POINT_2_MS] },
      {
        name: 'cpu',
        type: FieldType.number,
        values: [10, 42],
        labels: { instance: 'host-a' },
        config: { unit: 'percent' },
      },
    ],
  });
  frame.fields.forEach((f) => {
    f.display = passthroughDisplay;
  });
  return frame;
}

function baseArgs(alignedFrame: DataFrame) {
  return {
    alignedFrame,
    seriesIdx: 1,
    dataIdxs: [1, 1],
    dataSeries: [alignedFrame],
    annotations: [],
    panelId: 4,
    panelTitle: 'CPU usage',
    timeRange: makeTimeRange(),
    replaceVariables: noopReplace,
    xVal: POINT_2_MS,
  };
}

/** Pulls the `data` payload out of the single returned structured context item. */
function getData(items: ReturnType<typeof buildDatapointAssistantContext>) {
  expect(items).toHaveLength(1);
  // The mocked createAssistantContextItem returns { type, params }.
  // @ts-expect-error -- accessing the mocked shape.
  return items[0].params.data;
}

describe('buildDatapointAssistantContext', () => {
  it('returns an empty array when the hovered series index has no data point', () => {
    const alignedFrame = makeAlignedFrame();
    const items = buildDatapointAssistantContext({
      ...baseArgs(alignedFrame),
      dataIdxs: [1, null],
    });
    expect(items).toEqual([]);
  });

  it('returns an empty array when the x index is missing', () => {
    const alignedFrame = makeAlignedFrame();
    const items = buildDatapointAssistantContext({
      ...baseArgs(alignedFrame),
      dataIdxs: [null, 1],
    });
    expect(items).toEqual([]);
  });

  it('returns an empty array when the series field does not exist', () => {
    const alignedFrame = makeAlignedFrame();
    const items = buildDatapointAssistantContext({
      ...baseArgs(alignedFrame),
      seriesIdx: 5,
    });
    expect(items).toEqual([]);
  });

  it('builds a single datapoint pill for a hovered time-series point', () => {
    const alignedFrame = makeAlignedFrame();
    const data = getData(buildDatapointAssistantContext(baseArgs(alignedFrame)));

    expect(data.kind).toBe('viz-datapoint');
    expect(data.point).toMatchObject({
      timestamp: POINT_2_ISO,
      value: 42,
      displayValue: '42',
      unit: 'percent',
    });
    expect(data.series).toMatchObject({
      name: 'cpu host-a',
      labels: { instance: 'host-a' },
      unit: 'percent',
    });
    expect(data.panel).toMatchObject({ panelId: 4, panelTitle: 'CPU usage' });
  });

  it('uses the formatted x display (not an ISO timestamp) for a non-time x axis', () => {
    const frame = createDataFrame({
      refId: 'A',
      fields: [
        { name: 'bucket', type: FieldType.number, values: [1, 2] },
        { name: 'count', type: FieldType.number, values: [10, 42] },
      ],
    });
    frame.fields.forEach((f) => {
      f.display = passthroughDisplay;
    });

    const data = getData(
      buildDatapointAssistantContext({
        ...baseArgs(frame),
        xVal: 2,
      })
    );

    expect(data.point.timestamp).toBe('2');
  });

  it('resolves refId and query from the origin source frame when present', () => {
    const alignedFrame = makeAlignedFrame({ refId: 'aligned', executedQueryString: 'aligned query' });
    const sourceFrame = createDataFrame({
      refId: 'B',
      meta: { executedQueryString: 'SELECT cpu FROM host' },
      fields: [{ name: 'cpu', type: FieldType.number, values: [10, 42] }],
    });
    alignedFrame.fields[1].state = { origin: { frameIndex: 0, fieldIndex: 1 } };

    const data = getData(
      buildDatapointAssistantContext({
        ...baseArgs(alignedFrame),
        dataSeries: [sourceFrame],
      })
    );

    expect(data.series.refId).toBe('B');
    expect(data.series.query).toBe('SELECT cpu FROM host');
  });

  it('falls back to the aligned frame refId and query when origin is missing', () => {
    const alignedFrame = makeAlignedFrame({ refId: 'aligned', executedQueryString: 'aligned query' });

    const data = getData(buildDatapointAssistantContext(baseArgs(alignedFrame)));

    expect(data.series.refId).toBe('aligned');
    expect(data.series.query).toBe('aligned query');
  });

  it('computes series stats, skipping nulls for first/last', () => {
    const alignedFrame = makeAlignedFrame();
    // Null-pad the series as timeseries joins commonly do.
    alignedFrame.fields[1].values = [null, 42];

    const data = getData(
      buildDatapointAssistantContext({
        ...baseArgs(alignedFrame),
      })
    );

    expect(data.series.stats).toMatchObject({ max: 42, min: 42, firstNotNull: 42, lastNotNull: 42 });
  });

  it('includes annotations that fall within the hovered point window', () => {
    const alignedFrame = makeAlignedFrame();
    const annotationFrame = createDataFrame({
      name: 'annotations',
      fields: [
        { name: 'time', type: FieldType.time, values: [POINT_2_MS] },
        { name: 'title', type: FieldType.string, values: ['Deploy'] },
        { name: 'text', type: FieldType.string, values: ['Rolled out v2'] },
      ],
    });

    const data = getData(
      buildDatapointAssistantContext({
        ...baseArgs(alignedFrame),
        annotations: [annotationFrame],
      })
    );

    expect(data.point.annotations).toEqual([
      expect.objectContaining({ title: 'Deploy', text: 'Rolled out v2', time: POINT_2_ISO }),
    ]);
  });

  it('omits annotations when none fall near the hovered point', () => {
    const alignedFrame = makeAlignedFrame();
    const annotationFrame = createDataFrame({
      name: 'annotations',
      fields: [{ name: 'time', type: FieldType.time, values: [Date.UTC(2020, 0, 1)] }],
    });

    const data = getData(
      buildDatapointAssistantContext({
        ...baseArgs(alignedFrame),
        annotations: [annotationFrame],
      })
    );

    expect(data.point.annotations).toBeUndefined();
  });

  it('resolves dashboard macros, leaving them undefined when not interpolated', () => {
    const alignedFrame = makeAlignedFrame();
    const replaceVariables: InterpolateFunction = (s) => (s === '${__dashboard.uid}' ? 'abc-123' : String(s));

    const data = getData(
      buildDatapointAssistantContext({
        ...baseArgs(alignedFrame),
        replaceVariables,
      })
    );

    expect(data.panel.dashboardUid).toBe('abc-123');
    // Unresolved macro string is treated as absent.
    expect(data.panel.dashboardTitle).toBeUndefined();
  });
});

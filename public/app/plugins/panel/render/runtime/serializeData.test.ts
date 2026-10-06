import {
  createDataFrame,
  createTheme,
  dateTime,
  FieldType,
  getDisplayProcessor,
  LoadingState,
  type PanelData,
  ThresholdsMode,
  toDataFrame,
} from '@grafana/data';
import { setTemplateSrv, type TemplateSrv } from '@grafana/runtime';

import {
  DASHBOARD_SOURCE_PANEL_ID_META_KEY,
  DASHBOARD_SOURCE_PANEL_TITLE_META_KEY,
  MAX_STRING_CELL_LENGTH,
  MAX_TRANSFER_BYTES,
  MAX_TRANSFER_CELLS,
  MAX_TRANSFER_FRAMES,
} from './constants';
import { buildRenderInput, serializePanelData } from './serializeData';

const theme = createTheme();

function panelData(series: PanelData['series'], extra: Partial<PanelData> = {}): PanelData {
  const range = { from: dateTime(1000), to: dateTime(2000), raw: { from: 'now-1h', to: 'now' } };
  return { state: LoadingState.Done, series, timeRange: range, ...extra };
}

function serialize(data: PanelData) {
  const result = serializePanelData(data, theme);
  if (!result.ok) {
    throw new Error(`expected data, got ${result.reason}`);
  }
  return result;
}

describe('serializePanelData', () => {
  it('converts time to epoch ms, non-finite numbers to null and objects to JSON', () => {
    const frame = toDataFrame({
      refId: 'A',
      name: 'cpu',
      fields: [
        { name: 'time', type: FieldType.time, values: [dateTime(1700000000000), '2024-01-01T00:00:00Z', 'nope'] },
        { name: 'value', type: FieldType.number, values: [1.5, NaN, Infinity], config: { unit: 'percent' } },
        { name: 'meta', type: FieldType.other, values: [{ a: 1 }, null, true] },
      ],
    });
    const { data, cells } = serialize(panelData([frame]));

    expect(cells).toBe(9);
    expect(data.state).toBe('Done');
    expect(data.series[0]).toMatchObject({ refId: 'A', name: 'cpu', length: 3 });
    expect(data.series[0].fields.map((field) => field.values)).toEqual([
      [1700000000000, 1704067200000, null],
      [1.5, null, null],
      ['{"a":1}', null, true],
    ]);
    expect(data.series[0].fields[1]).toMatchObject({ type: 'number', unit: 'percent' });
  });

  it('cuts long strings and marks the cut', () => {
    const long = 'x'.repeat(MAX_STRING_CELL_LENGTH + 10);
    const frame = createDataFrame({ fields: [{ name: 'text', type: FieldType.string, values: [long, 'short'] }] });
    const [values] = serialize(panelData([frame])).data.series[0].fields.map((field) => field.values);
    expect(values[0]).toBe(`${'x'.repeat(MAX_STRING_CELL_LENGTH)}…`);
    expect(values[1]).toBe('short');
  });

  it('reads the dashboard source panel from frame meta', () => {
    const withSource = createDataFrame({
      refId: 'A',
      meta: { custom: { [DASHBOARD_SOURCE_PANEL_ID_META_KEY]: 4, [DASHBOARD_SOURCE_PANEL_TITLE_META_KEY]: 'Errors' } },
      fields: [],
    });
    const invalidId = createDataFrame({
      refId: 'A',
      meta: { custom: { [DASHBOARD_SOURCE_PANEL_ID_META_KEY]: 1.5, [DASHBOARD_SOURCE_PANEL_TITLE_META_KEY]: 'Nope' } },
      fields: [],
    });
    const longTitle = createDataFrame({
      meta: {
        custom: { [DASHBOARD_SOURCE_PANEL_ID_META_KEY]: 9, [DASHBOARD_SOURCE_PANEL_TITLE_META_KEY]: 't'.repeat(250) },
      },
      fields: [],
    });
    const series = serialize(panelData([withSource, invalidId, longTitle])).data.series;
    expect(series[0].source).toEqual({ panelId: 4, title: 'Errors' });
    expect(series[1].source).toBeUndefined();
    expect(series[2].source).toEqual({ panelId: 9, title: 't'.repeat(200) });
  });

  it('takes the last display text and color from field.display', () => {
    const frame = createDataFrame({
      fields: [
        {
          name: 'value',
          type: FieldType.number,
          values: [10, 95, null],
          config: {
            unit: 'percent',
            decimals: 0,
            thresholds: {
              mode: ThresholdsMode.Absolute,
              steps: [
                { value: -Infinity, color: 'green' },
                { value: 90, color: 'red' },
              ],
            },
            color: { mode: 'thresholds' },
          },
        },
      ],
    });
    const field = frame.fields[0];
    field.display = getDisplayProcessor({ field, theme });

    const serialized = serialize(panelData([frame])).data.series[0].fields[0];
    expect(serialized.lastDisplay).toBe('95%');
    expect(serialized.lastColor).toBe(theme.visualization.getColorByName('red'));
    expect(serialized.thresholds).toEqual([
      { value: null, color: theme.visualization.getColorByName('green') },
      { value: 90, color: theme.visualization.getColorByName('red') },
    ]);
  });

  it('omits thresholds in percentage mode', () => {
    const frame = createDataFrame({
      fields: [
        {
          name: 'value',
          type: FieldType.number,
          values: [1],
          config: { thresholds: { mode: ThresholdsMode.Percentage, steps: [{ value: -Infinity, color: 'green' }] } },
        },
      ],
    });
    expect(serialize(panelData([frame])).data.series[0].fields[0].thresholds).toBeUndefined();
  });

  it('carries query errors as messages', () => {
    const { data } = serialize(
      panelData([], { state: LoadingState.Error, errors: [{ refId: 'B', message: 'timeout' }, { message: 'other' }] })
    );
    expect(data).toEqual({ state: 'Error', series: [], errors: ['B: timeout', 'other'] });
  });

  it('refuses more frames than the limit', () => {
    const frames = Array.from({ length: MAX_TRANSFER_FRAMES + 1 }, () => createDataFrame({ fields: [] }));
    expect(serializePanelData(panelData(frames), theme)).toEqual({
      ok: false,
      reason: 'too-many-frames',
      actual: MAX_TRANSFER_FRAMES + 1,
      limit: MAX_TRANSFER_FRAMES,
    });
  });

  it('refuses more cells than the limit', () => {
    const values = new Array(MAX_TRANSFER_CELLS / 2 + 1).fill(1);
    const frame = createDataFrame({
      fields: [
        { name: 'a', type: FieldType.number, values },
        { name: 'b', type: FieldType.number, values },
      ],
    });
    expect(serializePanelData(panelData([frame]), theme)).toEqual({
      ok: false,
      reason: 'too-many-cells',
      actual: MAX_TRANSFER_CELLS + 2,
      limit: MAX_TRANSFER_CELLS,
    });
  });
});

describe('buildRenderInput', () => {
  beforeEach(() => {
    setTemplateSrv({ getVariables: () => [{ name: 'env' }] } as unknown as TemplateSrv);
  });

  const replaceVariables = (value: string) =>
    ({ '${env:json}': '["prod","dev"]', '${env:text}': 'prod + dev' })[value] ?? value;

  const params = (series: PanelData['series']) => ({
    data: panelData(series),
    timeRange: { from: dateTime(1000), to: dateTime(2000), raw: { from: 'now-1h', to: 'now' } },
    timeZone: 'utc',
    replaceVariables,
    theme,
    width: 320,
    height: 200,
    isRenderTarget: true,
  });

  it('builds the full snapshot with resolved time zone and variables', () => {
    const result = buildRenderInput(params([]));
    if (!result.ok) {
      throw new Error(result.reason);
    }
    expect(result.input).toMatchObject({
      timeRange: { from: 1000, to: 2000, raw: { from: 'now-1h', to: 'now' } },
      timeZone: 'UTC',
      variables: { env: { value: ['prod', 'dev'], text: 'prod + dev' } },
      size: { width: 320, height: 200 },
      isRenderTarget: true,
    });
    expect(result.bytes).toBe(JSON.stringify(result.input).length);
  });

  it('refuses an input whose JSON is over the byte limit', () => {
    const big = 'x'.repeat(MAX_STRING_CELL_LENGTH);
    const rows = Math.ceil(MAX_TRANSFER_BYTES / MAX_STRING_CELL_LENGTH) + 1;
    const frame = createDataFrame({
      fields: [{ name: 's', type: FieldType.string, values: new Array(rows).fill(big) }],
    });
    const result = buildRenderInput(params([frame]));
    expect(result).toMatchObject({ ok: false, reason: 'too-large', limit: MAX_TRANSFER_BYTES });
    expect(result.ok === false && result.actual > MAX_TRANSFER_BYTES).toBe(true);
  });
});

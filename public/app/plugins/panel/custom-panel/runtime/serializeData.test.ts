import {
  createDataFrame,
  createTheme,
  dateTime,
  FieldType,
  getDisplayProcessor,
  LoadingState,
  MappingType,
  type PanelData,
  ThresholdsMode,
  toDataFrame,
} from '@grafana/data';

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
    expect(data.series[0].fields[1]).toMatchObject({
      name: 'value',
      type: 'number',
      config: { unit: 'percent' },
      state: { displayName: 'value' },
    });
    expect(data.timeRange).toEqual({ from: 1000, to: 2000, raw: { from: 'now-1h', to: 'now' } });
  });

  it('cuts long strings and marks the cut', () => {
    const long = 'x'.repeat(MAX_STRING_CELL_LENGTH + 10);
    const frame = createDataFrame({ fields: [{ name: 'text', type: FieldType.string, values: [long, 'short'] }] });
    const [values] = serialize(panelData([frame])).data.series[0].fields.map((field) => field.values);
    expect(values[0]).toBe(`${'x'.repeat(MAX_STRING_CELL_LENGTH)}…`);
    expect(values[1]).toBe('short');
  });

  it('keeps only the dashboard source panel in frame meta', () => {
    const withSource = createDataFrame({
      refId: 'A',
      meta: {
        executedQueryString: 'SELECT secret',
        custom: {
          [DASHBOARD_SOURCE_PANEL_ID_META_KEY]: 4,
          [DASHBOARD_SOURCE_PANEL_TITLE_META_KEY]: 'Errors',
          other: 1,
        },
      },
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
    expect(series[0].meta).toEqual({ custom: { dashboardSourcePanelId: 4, dashboardSourcePanelTitle: 'Errors' } });
    expect(series[1].meta).toBeUndefined();
    expect(series[2].meta).toEqual({
      custom: { dashboardSourcePanelId: 9, dashboardSourcePanelTitle: 't'.repeat(200) },
    });
  });

  it('precomputes the display of the last value and keeps the FieldConfig display keys', () => {
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
            links: [{ title: 'x', url: 'https://example.com' }],
            custom: { lineWidth: 2 },
            mappings: [{ type: MappingType.ValueToText, options: { '1': { text: 'one' } } }],
          },
        },
      ],
    });
    const field = frame.fields[0];
    field.display = getDisplayProcessor({ field, theme });

    const serialized = serialize(panelData([frame])).data.series[0].fields[0];
    expect(serialized.state.lastNotNullDisplay).toEqual({
      text: '95',
      suffix: '%',
      numeric: 95,
      color: theme.visualization.getColorByName('red'),
      percent: 1,
    });
    expect(serialized.config).toEqual({
      unit: 'percent',
      decimals: 0,
      thresholds: {
        mode: 'absolute',
        steps: [
          { value: null, color: theme.visualization.getColorByName('green') },
          { value: 90, color: theme.visualization.getColorByName('red') },
        ],
      },
      color: { mode: 'thresholds' },
      mappings: [{ type: 'value', options: { '1': { text: 'one' } } }],
    });
  });

  it('carries query errors as messages', () => {
    const { data } = serialize(
      panelData([], { state: LoadingState.Error, errors: [{ refId: 'B', message: 'timeout' }, { message: 'other' }] })
    );
    expect(data.errors).toEqual([{ refId: 'B', message: 'timeout' }, { message: 'other' }]);
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
  const params = (series: PanelData['series']) => ({
    id: 7,
    title: 'Overview',
    data: panelData(series),
    timeRange: { from: dateTime(1000), to: dateTime(2000), raw: { from: 'now-1h', to: 'now' } },
    timeZone: 'utc',
    options: { code: 'panel.onRender(() => {})', mode: 'compact', fn: () => 1 },
    fieldConfig: {
      defaults: { unit: 'ms', links: [{ title: 'x', url: 'https://example.com' }] },
      overrides: [
        {
          matcher: { id: 'byName', options: 'cpu' },
          properties: [
            { id: 'unit', value: 'percent' },
            { id: 'links', value: [] },
            { id: 'custom.width', value: 3 },
          ],
        },
      ],
    },
    theme,
    width: 320,
    height: 200,
    transparent: true,
    fitContent: false,
    location: { pathname: '/d/abc/overview', search: '?orgId=1&var-env=prod' },
  });

  it('builds a PanelProps-shaped snapshot with a resolved time zone and the dashboard URL', () => {
    const result = buildRenderInput(params([]));
    if (!result.ok) {
      throw new Error(result.reason);
    }
    expect(result.input).toMatchObject({
      id: 7,
      title: 'Overview',
      timeRange: { from: 1000, to: 2000, raw: { from: 'now-1h', to: 'now' } },
      timeZone: 'UTC',
      options: { mode: 'compact' },
      fieldConfig: {
        defaults: { unit: 'ms' },
        overrides: [{ matcher: { id: 'byName', options: 'cpu' }, properties: [{ id: 'unit', value: 'percent' }] }],
      },
      width: 320,
      height: 200,
      transparent: true,
      fitContent: false,
      location: { pathname: '/d/abc/overview', search: '?orgId=1&var-env=prod' },
    });
    expect(result.input.options).toEqual({ mode: 'compact' });
    expect(result.input.fieldConfig.defaults).toEqual({ unit: 'ms' });
    expect(result.input.theme.colorScheme).toBe(theme.isDark ? 'dark' : 'light');
    expect(result.input.theme.vars['--gf-color-text-primary']).toBe(theme.colors.text.primary);
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

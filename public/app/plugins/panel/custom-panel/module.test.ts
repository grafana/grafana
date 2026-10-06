import {
  applyFieldOverrides,
  createTheme,
  dateTime,
  FieldConfigProperty,
  type FieldConfigSource,
  FieldMatcherID,
  FieldType,
  LoadingState,
  PanelOptionsEditorBuilder,
  toDataFrame,
} from '@grafana/data';

import { CustomPanel } from './CustomPanel';
import { CustomPanelCodeEditor } from './CustomPanelCodeEditor';
import { customPanelChangeHandler, customPanelMigrationHandler, needsApiVersionPin } from './migrations';
import { plugin } from './module';
import {
  DASHBOARD_SOURCE_PANEL_ID_META_KEY,
  DASHBOARD_SOURCE_PANEL_TITLE_META_KEY,
  DRAWING_API_VERSION,
} from './runtime/constants';
import { serializePanelData } from './runtime/serializeData';
import { getDefaultDrawingCode } from './templates';
import { type Options } from './types';

describe('custom panel module', () => {
  it('renders CustomPanel without the panel padding and supports content-fit layouts', () => {
    expect(plugin.panel).toBe(CustomPanel);
    expect(plugin.noPadding).toBe(true);
    expect(plugin.supportsFitContent).toBe(true);
  });

  it('defaults new panels to the KPI briefing template and the latest drawing API version', () => {
    expect(plugin.defaults).toEqual({ code: getDefaultDrawingCode(), apiVersion: DRAWING_API_VERSION });
  });

  it('pins saved panels without a version through the migration handler', () => {
    expect(plugin.onPanelMigration).toBe(customPanelMigrationHandler);
    expect(plugin.shouldMigrate).toBe(needsApiVersionPin);
  });

  it('edits the code option with the custom panel code editor', () => {
    const builder = new PanelOptionsEditorBuilder<Options>();
    plugin.getPanelOptionsSupplier()(builder, { data: [] });

    const items = builder.getItems();
    expect(items.map((item) => item.path)).toEqual(['code', 'apiVersion']);
    expect(items[0].editor).toBe(CustomPanelCodeEditor);
    // The version is never edited in the UI.
    expect(items[1].showIf?.({ code: '' }, [])).toBe(false);
  });

  it('converts options when another panel type changes into this one', () => {
    expect(plugin.onPanelTypeChanged).toBe(customPanelChangeHandler);
  });

  it('offers the standard options that shape field.config and the formatted last value', () => {
    const ids = plugin.fieldConfigRegistry.list().map((item) => item.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        FieldConfigProperty.Unit,
        FieldConfigProperty.Decimals,
        FieldConfigProperty.Min,
        FieldConfigProperty.Max,
        FieldConfigProperty.DisplayName,
        FieldConfigProperty.Color,
        FieldConfigProperty.Thresholds,
        FieldConfigProperty.Mappings,
        FieldConfigProperty.NoValue,
      ])
    );
    expect(ids).not.toContain(FieldConfigProperty.Links);
    expect(ids).not.toContain(FieldConfigProperty.Actions);
  });

  it("applies the panel's field config defaults and overrides to the data the drawing code gets", () => {
    const theme = createTheme();
    const fieldConfig: FieldConfigSource = {
      defaults: { unit: 'reqps' },
      overrides: [
        {
          matcher: { id: FieldMatcherID.byName, options: 'errors' },
          properties: [
            { id: 'unit', value: 'percent' },
            { id: 'decimals', value: 1 },
          ],
        },
      ],
    };
    const local = toDataFrame({
      refId: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        { name: 'requests', type: FieldType.number, values: [50, 70] },
        { name: 'errors', type: FieldType.number, values: [3, 4] },
        // A unit from the datasource wins over the panel default, as in every core panel.
        { name: 'bytes', type: FieldType.number, values: [1, 2048], config: { unit: 'bytes' } },
      ],
    });
    // A -- Dashboard -- frame: the source panel's query result, without the source panel's field config.
    const fromDashboard = toDataFrame({
      refId: 'B',
      meta: { custom: { [DASHBOARD_SOURCE_PANEL_ID_META_KEY]: 2, [DASHBOARD_SOURCE_PANEL_TITLE_META_KEY]: 'API' } },
      fields: [{ name: 'latency', type: FieldType.number, values: [12] }],
    });
    const series = applyFieldOverrides({
      data: [local, fromDashboard],
      fieldConfig,
      fieldConfigRegistry: plugin.fieldConfigRegistry,
      replaceVariables: (value) => value,
      theme,
    });
    const range = { from: dateTime(1000), to: dateTime(2000), raw: { from: 'now-1h', to: 'now' } };
    const result = serializePanelData({ state: LoadingState.Done, series, timeRange: range }, theme);
    if (!result.ok) {
      throw new Error(`expected data, got ${result.reason}`);
    }

    const [requests, errors, bytes] = result.data.series[0].fields.slice(1);
    expect(requests.config.unit).toBe('reqps');
    expect(requests.state.lastNotNullDisplay).toMatchObject({ text: '70', suffix: ' req/s', numeric: 70 });
    expect(errors.config).toMatchObject({ unit: 'percent', decimals: 1 });
    expect(errors.state.lastNotNullDisplay).toMatchObject({ text: '4.0', suffix: '%' });
    expect(bytes.config.unit).toBe('bytes');
    expect(bytes.state.lastNotNullDisplay).toMatchObject({ text: '2', suffix: ' KiB' });

    const latency = result.data.series[1].fields[0];
    expect(latency.config.unit).toBe('reqps');
    expect(latency.state.lastNotNullDisplay).toMatchObject({ text: '12', suffix: ' req/s' });
  });
});

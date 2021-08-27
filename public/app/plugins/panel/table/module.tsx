import { FieldOverrideContext, getFieldDisplayName, PanelPlugin } from '@grafana/data';
import { TablePanel } from './TablePanel';
import { PanelOptions, PanelFieldConfig, defaultPanelOptions, defaultPanelFieldConfig } from './models.gen';
import { tableMigrationHandler, tablePanelChangedHandler } from './migrations';
import { TableCellDisplayMode } from '@grafana/ui';

export const plugin = new PanelPlugin<PanelOptions, PanelFieldConfig>(TablePanel)
  .setPanelChangeHandler(tablePanelChangedHandler)
  .setMigrationHandler(tableMigrationHandler)
  .setNoPadding()
  .useFieldConfig({
    useCustomConfig: (builder) => {
      builder
        .addNumberInput({
          path: 'minWidth',
          name: 'Minimum column width',
          description: 'The minimum width for column auto resizing',
          settings: {
            placeholder: '150',
            min: 50,
            max: 500,
          },
          shouldApply: () => true,
          defaultValue: defaultPanelFieldConfig.minWidth,
        })
        .addNumberInput({
          path: 'width',
          name: 'Column width',
          settings: {
            placeholder: 'auto',
            min: 20,
            max: 300,
          },
          shouldApply: () => true,
          defaultValue: defaultPanelFieldConfig.width,
        })
        .addRadio({
          path: 'align',
          name: 'Column alignment',
          settings: {
            options: [
              { label: 'auto', value: 'auto' },
              { label: 'left', value: 'left' },
              { label: 'center', value: 'center' },
              { label: 'right', value: 'right' },
            ],
          },
          defaultValue: defaultPanelFieldConfig.align,
        })
        .addSelect({
          path: 'displayMode',
          name: 'Cell display mode',
          description: 'Color text, background, show as gauge, etc',
          settings: {
            options: [
              { value: TableCellDisplayMode.Auto, label: 'Auto' },
              { value: TableCellDisplayMode.ColorText, label: 'Color text' },
              { value: TableCellDisplayMode.ColorBackground, label: 'Color background (gradient)' },
              { value: TableCellDisplayMode.ColorBackgroundSolid, label: 'Color background (solid)' },
              { value: TableCellDisplayMode.GradientGauge, label: 'Gradient gauge' },
              { value: TableCellDisplayMode.LcdGauge, label: 'LCD gauge' },
              { value: TableCellDisplayMode.BasicGauge, label: 'Basic gauge' },
              { value: TableCellDisplayMode.JSONView, label: 'JSON View' },
              { value: TableCellDisplayMode.Image, label: 'Image' },
            ],
          },
          defaultValue: defaultPanelFieldConfig.displayMode,
        })
        .addBooleanSwitch({
          path: 'filterable',
          name: 'Column filter',
          description: 'Enables/disables field filters in table',
          defaultValue: defaultPanelFieldConfig.filterable,
        });
    },
  })
  .setPanelOptions((builder) => {
    builder
      .addBooleanSwitch({
        path: 'showHeader',
        name: 'Show header',
        description: "To display table's header or not to display",
        defaultValue: defaultPanelOptions.showHeader,
      })
      .addRadio({
        category: ['Table footer'],
        path: 'footerMode',
        name: 'Mode',
        settings: {
          options: [
            { label: 'none', value: 'none' },
            // { label: 'auto', value: 'auto' },  // TODO: when frame meta supports this
            { label: 'summary', value: 'summary' },
            { label: 'frame', value: 'frame' },
          ],
        },
        defaultValue: 'none',
      })
      .addSelect({
        category: ['Table footer'],
        path: 'footerSummary.reducer',
        name: 'Summarize',
        description: 'Summarize values on footer',
        settings: {
          options: [
            { value: 'min', label: 'Min' },
            { value: 'max', label: 'Max' },
            { value: 'sum', label: 'Sum' },
            { value: 'avg', label: 'Avg' },
          ],
        },
        defaultValue: 'sum',
        showIf: (cfg) => cfg.footerMode === 'summary',
      })
      .addMultiSelect({
        path: 'footerSummary.fields',
        name: 'Fields',
        description: 'Select the fields that should be summarized',
        category: ['Table footer'],
        settings: {
          allowCustomValue: false,
          options: [],
          getOptions: async (context: FieldOverrideContext) => {
            const options = [{ value: '', label: 'Numeric Fields' }];
            if (context && context.data && context.data.length > 0) {
              const frame = context.data[0];
              for (const field of frame.fields) {
                const name = getFieldDisplayName(field, frame, context.data);
                const value = field.name;
                options.push({ value, label: name });
              }
            }
            return options;
          },
        },
        defaultValue: '',
        showIf: (cfg) => cfg.footerMode === 'summary',
      })
      .addSelect({
        category: ['Table footer'],
        path: 'footerFrame',
        name: 'Frame',
        description: 'Select a Frame to use as the summary',
        settings: {
          options: [],
          getOptions: async (context: FieldOverrideContext) => {
            if (context && context.data && context.data.length > 1) {
              const frames = context.data.filter((_, i) => i > 0);
              return frames.map((f) => ({ value: f.name, label: f.name }));
            }
            return [];
          },
        },
        showIf: (cfg) => cfg.footerMode === 'frame',
      });
  });

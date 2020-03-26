import { PanelPlugin } from '@grafana/data';
import { TablePanel } from './TablePanel';
import { Options, defaults } from './types';

export const plugin = new PanelPlugin<Options>(TablePanel)
  .setDefaults(defaults)
  .setCustomFieldConfigEditor(builder => {
    builder
      .addNumberInput({
        id: 'width',
        name: 'Column width',
        description: 'column width (for table)',
        settings: {
          placeholder: 'auto',
          min: 20,
          max: 300,
        },
      })
      .addSelect({
        id: 'displayMode',
        name: 'Cell display mode',
        description: 'Color value, background, show as gauge, etc',

        settings: {
          options: [
            { value: 'auto', label: 'Auto' },
            { value: 'color-background', label: 'Color background' },
            { value: 'gradient-gauge', label: 'Gradient gauge' },
            { value: 'lcd-gauge', label: 'LCD gauge' },
          ],
        },
      });
  })
  .setOptionsEditor(builder => {
    builder.addBooleanSwitch({
      id: 'showHeader',
      name: 'Show header',
      description: "To display table's header or not to display",
    });
  });

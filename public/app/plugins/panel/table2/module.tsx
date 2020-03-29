import { PanelPlugin } from '@grafana/data';
import { TablePanel } from './TablePanel';
import { Options, defaults } from './types';

export const plugin = new PanelPlugin<Options>(TablePanel)
  .setDefaults(defaults)
  .setCustomFieldOptions(builder => {
    builder
      .addNumberInput({
        id: 'width',
        name: 'Column width',
        description: 'column width (for table)',
        category: ['Table field options'],
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
        category: ['Table field options'],
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
  .setPanelOptions(builder => {
    builder
      .addBooleanSwitch({
        id: 'showHeader',
        name: 'Show header',
        description: "To display table's header or not to display",
        category: ['Header'],
      })
      .addNumberInput({
        id: 'headerFontSize',
        name: 'Font size',
        description: 'Header font size',
        category: ['Header'],
      })
      .addSelect({
        id: 'headerFont',
        name: 'Font',
        description: 'Font used in table header',
        category: ['Header'],
        settings: {
          options: [
            { value: 'helvetica', label: 'Old good fellow Helvetica' },
            { value: 'comic-sans', label: 'Funky yet professionsl Comic Sans ' },
          ],
        },
      });
  });

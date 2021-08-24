import { PanelOptionsEditorBuilder } from '@grafana/data';
import { VizGridLines, OptionsWithGridLines } from '@grafana/schema';

/**
 * @public
 */
export function addGridLinesOptions<T extends OptionsWithGridLines>(builder: PanelOptionsEditorBuilder<T>) {
  builder.addRadio({
    path: 'grid',
    name: 'Grid lines',
    category: ['Graph styles'],
    description: '',
    defaultValue: VizGridLines.Both,
    settings: {
      options: [
        { value: VizGridLines.Horizontal, label: 'Horizontal' },
        { value: VizGridLines.Vertical, label: 'Veritcal' },
        { value: VizGridLines.Both, label: 'Both' },
        { value: VizGridLines.None, label: 'None' },
      ],
    },
  });
}

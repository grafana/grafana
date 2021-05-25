import { OptionsWithTooltip } from '../models.gen';
import { PanelOptionsEditorBuilder } from '@grafana/data';

export function addTooltipOptions<T extends OptionsWithTooltip>(builder: PanelOptionsEditorBuilder<T>) {
  builder.addRadio({
    path: 'tooltip.mode',
    name: 'Tooltip mode',
    category: ['Tooltip'],
    description: '',
    defaultValue: 'single',
    settings: {
      options: [
        { value: 'single', label: 'Single' },
        { value: 'multi', label: 'All' },
        { value: 'none', label: 'Hidden' },
      ],
    },
  });
}

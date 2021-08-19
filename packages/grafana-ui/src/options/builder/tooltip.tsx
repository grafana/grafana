import { OptionsWithTooltip } from '../models.gen';
import { PanelOptionsEditorBuilder } from '@grafana/data';

export function addTooltipOptions<T extends OptionsWithTooltip>(
  builder: PanelOptionsEditorBuilder<T>,
  singleOnly = false
) {
  const options = singleOnly
    ? [
        { value: 'single', label: 'Single' },
        { value: 'none', label: 'Hidden' },
      ]
    : [
        { value: 'single', label: 'Single' },
        { value: 'multi', label: 'All' },
        { value: 'none', label: 'Hidden' },
      ];

  builder.addRadio({
    path: 'tooltip.mode',
    name: 'Tooltip mode',
    category: ['Tooltip'],
    description: '',
    defaultValue: 'single',
    settings: {
      options,
    },
  });
}

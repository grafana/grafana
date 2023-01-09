import { PanelOptionsEditorBuilder } from '@grafana/data';
import { OptionsWithTooltip, TooltipDisplayMode, SortOrder } from '@grafana/schema';

export enum TooltipModeOptions {
  SingleOnly = 'single',
  MultiOnly = 'multi',
  Both = 'both',
}

export function addTooltipOptions<T extends OptionsWithTooltip>(
  builder: PanelOptionsEditorBuilder<T>,
  modeType = TooltipModeOptions.Both
) {
  const category = ['Tooltip'];
  let modeOptions = [];

  switch (modeType) {
    case TooltipModeOptions.MultiOnly:
      modeOptions = [
        { value: TooltipDisplayMode.Multi, label: 'All' },
        { value: TooltipDisplayMode.None, label: 'Hidden' },
      ];
      break;
    case TooltipModeOptions.SingleOnly:
      modeOptions = [
        { value: TooltipDisplayMode.Single, label: 'Single' },
        { value: TooltipDisplayMode.None, label: 'Hidden' },
      ];
      break;
    case TooltipModeOptions.Both:
      modeOptions = [
        { value: TooltipDisplayMode.Single, label: 'Single' },
        { value: TooltipDisplayMode.Multi, label: 'All' },
        { value: TooltipDisplayMode.None, label: 'Hidden' },
      ];
      break;
  }

  const sortOptions = [
    { value: SortOrder.None, label: 'None' },
    { value: SortOrder.Ascending, label: 'Ascending' },
    { value: SortOrder.Descending, label: 'Descending' },
  ];

  builder
    .addRadio({
      path: 'tooltip.mode',
      name: 'Tooltip mode',
      category,
      defaultValue: 'single',
      settings: {
        options: modeOptions,
      },
    })
    .addRadio({
      path: 'tooltip.sort',
      name: 'Values sort order',
      category,
      defaultValue: SortOrder.None,
      showIf: (options: T) => options.tooltip.mode === TooltipDisplayMode.Multi,
      settings: {
        options: sortOptions,
      },
    });
}

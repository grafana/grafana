import { PanelOptionsEditorBuilder } from '@grafana/data';
import { OptionsWithTooltip, TooltipDisplayMode, SortOrder } from '@grafana/schema';
import { DEFAULT_TOOLTIP_HEIGHT, DEFAULT_TOOLTIP_WIDTH } from '@grafana/ui/src/components/uPlot/plugins/TooltipPlugin2';

export function addTooltipOptions<T extends OptionsWithTooltip>(
  builder: PanelOptionsEditorBuilder<T>,
  singleOnly = false
) {
  const category = ['Tooltip'];
  const modeOptions = singleOnly
    ? [
        { value: TooltipDisplayMode.Single, label: 'Single' },
        { value: TooltipDisplayMode.None, label: 'Hidden' },
      ]
    : [
        { value: TooltipDisplayMode.Single, label: 'Single' },
        { value: TooltipDisplayMode.Multi, label: 'All' },
        { value: TooltipDisplayMode.None, label: 'Hidden' },
      ];

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
      showIf: (options: T) => options.tooltip?.mode === TooltipDisplayMode.Multi,
      settings: {
        options: sortOptions,
      },
    })
    .addSliderInput({
      path: 'tooltip.maxTooltipWidth',
      name: 'Max width',
      category,
      description: 'Maximum tooltip width',
      defaultValue: DEFAULT_TOOLTIP_WIDTH,
      settings: {
        min: 0,
        max: 1024,
        step: 1,
      },
    })
    .addSliderInput({
      path: 'tooltip.maxTooltipHeight',
      name: 'Max height',
      category,
      description: 'Maximum tooltip height',
      defaultValue: DEFAULT_TOOLTIP_HEIGHT,
      settings: {
        min: 0,
        max: 1024,
        step: 1,
      },
    });
}

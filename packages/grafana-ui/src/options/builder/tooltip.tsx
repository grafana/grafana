import { DataFrame, PanelOptionsEditorBuilder } from '@grafana/data';
import { OptionsWithTooltip, TooltipDisplayMode, SortOrder } from '@grafana/schema';

/** @internal */
export const optsWithHideZeros: OptionsWithTooltip = {
  tooltip: {
    mode: TooltipDisplayMode.Single,
    sort: SortOrder.None,
    hideZeros: false,
  },
};

export function addTooltipOptions<T extends OptionsWithTooltip>(
  builder: PanelOptionsEditorBuilder<T>,
  singleOnly = false,
  setProximity = false,
  defaultOptions?: Partial<OptionsWithTooltip>
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
      defaultValue: defaultOptions?.tooltip?.mode ?? TooltipDisplayMode.Single,
      settings: {
        options: modeOptions,
      },
    })
    .addRadio({
      path: 'tooltip.sort',
      name: 'Values sort order',
      category,
      defaultValue: defaultOptions?.tooltip?.sort ?? SortOrder.None,
      showIf: (options: T) => options.tooltip?.mode === TooltipDisplayMode.Multi,
      settings: {
        options: sortOptions,
      },
    })
    .addBooleanSwitch({
      path: 'tooltip.hideZeros',
      name: 'Hide zeros',
      category,
      defaultValue: false,
      showIf: (options: T) =>
        defaultOptions?.tooltip?.hideZeros !== undefined && options.tooltip?.mode === TooltipDisplayMode.Multi,
    });

  if (setProximity) {
    builder.addNumberInput({
      path: 'tooltip.hoverProximity',
      name: 'Hover proximity',
      description: 'How close the cursor must be to a point to trigger the tooltip, in pixels',
      category,
      settings: {
        integer: true,
      },
      showIf: (options: T) => options.tooltip?.mode !== TooltipDisplayMode.None,
    });
  }

  builder
    .addNumberInput({
      path: 'tooltip.maxWidth',
      name: 'Max width',
      category,
      settings: {
        integer: true,
      },
      showIf: (options: T) => options.tooltip?.mode !== TooltipDisplayMode.None,
    })
    .addNumberInput({
      path: 'tooltip.maxHeight',
      name: 'Max height',
      category,
      defaultValue: undefined,
      settings: {
        integer: true,
      },
      showIf: (options: T, data: DataFrame[] | undefined, annotations: DataFrame[] | undefined) => {
        return (
          options.tooltip?.mode === TooltipDisplayMode.Multi ||
          annotations?.some((df) => {
            return df.meta?.custom?.resultType === 'exemplar';
          })
        );
      },
    });
}

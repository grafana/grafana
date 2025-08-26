import { DataFrame, PanelOptionsEditorBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';
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
  const category = [t('grafana-ui.builder.tooltip.category', 'Tooltip')];
  const modeOptions = singleOnly
    ? [
        { value: TooltipDisplayMode.Single, label: t('grafana-ui.builder.tooltip.modeOptions.label-single', 'Single') },
        { value: TooltipDisplayMode.None, label: t('grafana-ui.builder.tooltip.modeOptions.label-hidden', 'Hidden') },
      ]
    : [
        { value: TooltipDisplayMode.Single, label: t('grafana-ui.builder.tooltip.modeOptions.label-single', 'Single') },
        { value: TooltipDisplayMode.Multi, label: t('grafana-ui.builder.tooltip.modeOptions.label-all', 'All') },
        { value: TooltipDisplayMode.None, label: t('grafana-ui.builder.tooltip.modeOptions.label-hidden', 'Hidden') },
      ];

  const sortOptions = [
    { value: SortOrder.None, label: t('grafana-ui.builder.tooltip.sortOptions.label-none', 'None') },
    { value: SortOrder.Ascending, label: t('grafana-ui.builder.tooltip.sortOptions.label-ascending', 'Ascending') },
    { value: SortOrder.Descending, label: t('grafana-ui.builder.tooltip.sortOptions.label-descending', 'Descending') },
  ];

  builder
    .addRadio({
      path: 'tooltip.mode',
      name: t('grafana-ui.builder.tooltip.name-tooltip-mode', 'Tooltip mode'),
      category,
      defaultValue: defaultOptions?.tooltip?.mode ?? TooltipDisplayMode.Single,
      settings: {
        options: modeOptions,
      },
    })
    .addRadio({
      path: 'tooltip.sort',
      name: t('grafana-ui.builder.tooltip.name-values-sort-order', 'Values sort order'),
      category,
      defaultValue: defaultOptions?.tooltip?.sort ?? SortOrder.None,
      showIf: (options: T) => options.tooltip?.mode === TooltipDisplayMode.Multi,
      settings: {
        options: sortOptions,
      },
    })
    .addBooleanSwitch({
      path: 'tooltip.hideZeros',
      name: t('grafana-ui.builder.tooltip.name-hide-zeros', 'Hide zeros'),
      category,
      defaultValue: false,
      showIf: (options: T) =>
        defaultOptions?.tooltip?.hideZeros !== undefined && options.tooltip?.mode === TooltipDisplayMode.Multi,
    });

  if (setProximity) {
    builder.addNumberInput({
      path: 'tooltip.hoverProximity',
      name: t('grafana-ui.builder.tooltip.name-hover-proximity', 'Hover proximity'),
      description: t(
        'grafana-ui.builder.tooltip.description-hover-proximity',
        'How close the cursor must be to a point to trigger the tooltip, in pixels'
      ),
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
      name: t('grafana-ui.builder.tooltip.name-max-width', 'Max width'),
      category,
      settings: {
        integer: true,
      },
      showIf: (options: T) => options.tooltip?.mode !== TooltipDisplayMode.None,
    })
    .addNumberInput({
      path: 'tooltip.maxHeight',
      name: t('grafana-ui.builder.tooltip.name-max-height', 'Max height'),
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

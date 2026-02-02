import { t } from 'i18next';

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
  // BMC Change: To enable localization for below text
  const category = [t('bmcgrafana.dashboards.edit-panel.tooltip.text', 'Tooltip')];
  const modeOptions = singleOnly
    ? [
        {
          value: TooltipDisplayMode.Single,
          label: t('bmcgrafana.dashboards.edit-panel.tooltip.mode-single', 'Single'),
        },
        { value: TooltipDisplayMode.None, label: t('bmcgrafana.dashboards.edit-panel.tooltip.mode-hidden', 'Hidden') },
      ]
    : [
        {
          value: TooltipDisplayMode.Single,
          label: t('bmcgrafana.dashboards.edit-panel.tooltip.mode-single', 'Single'),
        },
        { value: TooltipDisplayMode.Multi, label: t('bmcgrafana.dashboards.edit-panel.tooltip.mode-all', 'All') },
        { value: TooltipDisplayMode.None, label: t('bmcgrafana.dashboards.edit-panel.tooltip.mode-hidden', 'Hidden') },
      ];
  // BMC Change ends
  // BMC Change: Used function to localize below text
  function getSortOptions() {
    return [
      { value: SortOrder.None, label: t('bmcgrafana.dashboards.edit-panel.overrides.button.none', 'None') },
      {
        value: SortOrder.Ascending,
        label: t('bmcgrafana.dashboards.edit-panel.tooltip.values-sort-order-ascending', 'Ascending'),
      },
      {
        value: SortOrder.Descending,
        label: t('bmcgrafana.dashboards.edit-panel.tooltip.values-sort-order-descending', 'Descending'),
      },
    ];
  }
  // BMC Change ends

  builder
    .addRadio({
      path: 'tooltip.mode',
      // BMC Change: To enable localization for below text
      name: t('bmcgrafana.dashboards.edit-panel.tooltip.tooltip-mode', 'Tooltip mode'),
      // BMC Change ends
      category,
      defaultValue: defaultOptions?.tooltip?.mode ?? TooltipDisplayMode.Single,
      settings: {
        options: modeOptions,
      },
    })
    .addRadio({
      path: 'tooltip.sort',
      // BMC Change: To enable localization for below text
      name: t('bmcgrafana.dashboards.edit-panel.tooltip.values-sort-order', 'Values sort order'),
      // BMC Change ends
      category,
      defaultValue: defaultOptions?.tooltip?.sort ?? SortOrder.None,
      showIf: (options: T) => options.tooltip?.mode === TooltipDisplayMode.Multi,
      settings: {
        // BMC Change: Function call for localized text
        options: getSortOptions(),
        // BMC Change ends
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
      // BMC Change: To enable localization for below text
      name: t('bmcgrafana.dashboards.edit-panel.tooltip.hover-proximity', 'Hover proximity'),
      description: t(
        'bmcgrafana.dashboards.edit-panel.tooltip.hover-proximity-description',
        'How close the cursor must be to a point to trigger the tooltip, in pixels'
      ),
      // BMC Change ends
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
      // BMC Change: To enable localization for below text
      name: t('bmcgrafana.dashboards.edit-panel.tooltip.max-width', 'Max width'),
      // BMC Change ends
      category,
      settings: {
        integer: true,
      },
      showIf: (options: T) => options.tooltip?.mode !== TooltipDisplayMode.None,
    })
    .addNumberInput({
      path: 'tooltip.maxHeight',
      // BMC Change: To enable localization for below text
      name: t('bmcgrafana.dashboards.edit-panel.tooltip.max-height', 'Max height'),
      // BMC Change ends
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

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DashboardCursorSync } from '@grafana/schema';

// Kept apart from the settings view so the save review can word these settings without importing the view.

/** The dashboard's default grid choices, by layout kind (`AutoGridLayoutManager.descriptor.id` and so on). */
export function getDefaultGridOptions(): Array<SelectableValue<string>> {
  return [
    {
      label: t('dashboard-scene.general-settings-edit-view.default_grid_options.label.auto', 'Auto grid'),
      value: 'AutoGridLayout',
    },
    {
      label: t('dashboard-scene.general-settings-edit-view.default_grid_options.label.custom', 'Custom grid'),
      value: 'GridLayout',
    },
  ];
}

export function getGraphTooltipOptions(): Array<SelectableValue<DashboardCursorSync>> {
  return [
    {
      value: DashboardCursorSync.Off,
      label: t('dashboard-scene.general-settings-edit-view.graph_tooltip_options.label.default', 'Default'),
    },
    {
      value: DashboardCursorSync.Crosshair,
      label: t(
        'dashboard-scene.general-settings-edit-view.graph_tooltip_options.label.shared-crosshair',
        'Shared crosshair'
      ),
    },
    {
      value: DashboardCursorSync.Tooltip,
      label: t(
        'dashboard-scene.general-settings-edit-view.graph_tooltip_options.label.shared-tooltip',
        'Shared tooltip'
      ),
    },
  ];
}

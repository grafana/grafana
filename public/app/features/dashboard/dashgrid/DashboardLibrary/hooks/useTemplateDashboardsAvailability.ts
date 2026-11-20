import { type DataSourceInstanceListItem } from '@grafana/data';
import { config, useDataSourceInstanceList } from '@grafana/runtime';
import { useFlagGrafanaCustomDashboardTemplates } from '@grafana/runtime/internal';

import { getDashboardTemplatesTab } from '../enterprise-components/DashboardTemplatesTabExtension';
import { canReadDashboardTemplates } from '../utils/templatePermissions';

interface TemplateDashboardsAvailability {
  /** The first available `grafana-testdata-datasource`, used to power the Grafana-provisioned templates. */
  testDataSource: DataSourceInstanceListItem | undefined;
  /** Grafana-provisioned templates are available (feature toggle on AND a test datasource exists). */
  showGrafanaTemplates: boolean;
  /** Custom templates are available (flag on AND the enterprise tab is registered). */
  showCustomTemplates: boolean;
  /** Either source is available — use this to gate entry points and the modal mount. */
  isAvailable: boolean;
  /** The test datasource lookup is still running, so `showGrafanaTemplates` may still turn true. */
  isLoading: boolean;
}

/**
 * Single source of truth for whether the template-dashboards feature is reachable, combining the
 * Grafana-provisioned path (`config.featureToggles.dashboardTemplates` + a test datasource) and the
 * custom-templates path (`grafana.customDashboardTemplates` + a registered enterprise tab). Entry
 * points and the modal must agree on this, otherwise an entry point can navigate to a modal that
 * renders nothing.
 */
export function useTemplateDashboardsAvailability(): TemplateDashboardsAvailability {
  // Custom templates require the `dashboardtemplates:read` RBAC permission: without it the user
  // cannot list templates (the API denies it), so the tab/entry points must not be offered.
  const showCustomTemplates =
    useFlagGrafanaCustomDashboardTemplates() && getDashboardTemplatesTab() !== null && canReadDashboardTemplates();

  // Skip the lookup entirely when the Grafana-provisioned path is disabled — passing `undefined`
  // returns the full list, which is wasted work since we'd discard the result.
  const grafanaTemplatesEnabled = Boolean(config.featureToggles.dashboardTemplates);
  const { items, isLoading } = useDataSourceInstanceList(
    grafanaTemplatesEnabled ? { type: 'grafana-testdata-datasource' } : undefined
  );

  const testDataSource = grafanaTemplatesEnabled && !isLoading ? items[0] : undefined;
  const showGrafanaTemplates = Boolean(testDataSource);

  return {
    testDataSource,
    showGrafanaTemplates,
    showCustomTemplates,
    isAvailable: showGrafanaTemplates || showCustomTemplates,
    isLoading: grafanaTemplatesEnabled && isLoading,
  };
}

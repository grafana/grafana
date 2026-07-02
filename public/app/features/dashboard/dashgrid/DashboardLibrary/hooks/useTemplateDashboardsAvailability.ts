import { type DataSourceInstanceListItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useFlagGrafanaCustomDashboardTemplates } from '@grafana/runtime/internal';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';

import { getDashboardTemplatesTab } from '../enterprise-components/DashboardTemplatesTabExtension';

interface TemplateDashboardsAvailability {
  /** The first available `grafana-testdata-datasource`, used to power the Grafana-provisioned templates. */
  testDataSource: DataSourceInstanceListItem | undefined;
  /** Grafana-provisioned templates are available (feature toggle on AND a test datasource exists). */
  showGrafanaTemplates: boolean;
  /** Custom templates are available (flag on AND the enterprise tab is registered). */
  showCustomTemplates: boolean;
  /** Either source is available — use this to gate entry points and the modal mount. */
  isAvailable: boolean;
}

/**
 * Single source of truth for whether the template-dashboards feature is reachable, combining the
 * Grafana-provisioned path (`config.featureToggles.dashboardTemplates` + a test datasource) and the
 * custom-templates path (`grafana.customDashboardTemplates` + a registered enterprise tab). Entry
 * points and the modal must agree on this, otherwise an entry point can navigate to a modal that
 * renders nothing.
 */
export function useTemplateDashboardsAvailability(): TemplateDashboardsAvailability {
  const showCustomTemplates = useFlagGrafanaCustomDashboardTemplates() && getDashboardTemplatesTab() !== null;

  // Skip the lookup entirely when the Grafana-provisioned path is disabled — passing `undefined`
  // returns the full list, which is wasted work since we'd discard the result.
  const { items, isLoading } = useDataSourceInstanceList(
    config.featureToggles.dashboardTemplates ? { type: 'grafana-testdata-datasource' } : undefined
  );

  const testDataSource = config.featureToggles.dashboardTemplates && !isLoading ? items[0] : undefined;
  const showGrafanaTemplates = Boolean(testDataSource);

  return {
    testDataSource,
    showGrafanaTemplates,
    showCustomTemplates,
    isAvailable: showGrafanaTemplates || showCustomTemplates,
  };
}

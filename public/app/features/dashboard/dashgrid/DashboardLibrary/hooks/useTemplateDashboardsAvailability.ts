import { type DataSourceInstanceSettings } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { useFlagGrafanaCustomDashboardTemplates } from '@grafana/runtime/internal';

import { getDashboardTemplatesTab } from '../enterprise-components/DashboardTemplatesTabExtension';

interface TemplateDashboardsAvailability {
  /** The first available `grafana-testdata-datasource`, used to power the Grafana-provisioned templates. */
  testDataSource: DataSourceInstanceSettings | undefined;
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
  const testDataSource = config.featureToggles.dashboardTemplates
    ? getDataSourceSrv().getList({ type: 'grafana-testdata-datasource' })[0]
    : undefined;
  const showGrafanaTemplates = Boolean(testDataSource);

  return {
    testDataSource,
    showGrafanaTemplates,
    showCustomTemplates,
    isAvailable: showGrafanaTemplates || showCustomTemplates,
  };
}

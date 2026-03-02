import { config } from '@grafana/runtime';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { DashboardImportK8s } from './import/components/DashboardImportK8s';
import { DashboardImportLegacy } from './import/legacy/DashboardImportLegacy';

type RouteParams = {};
type QueryParams = { gcomDashboardId?: string };

type Props = GrafanaRouteComponentProps<RouteParams, QueryParams>;

/**
 * Dashboard Import Page
 *
 * Routes to different implementations based on the kubernetesDashboards feature toggle:
 * - DashboardImportK8s: Non-Redux implementation using local state and direct k8s API calls
 * - legacy/DashboardImportLegacy: Redux-based implementation using /api/dashboards/import endpoint
 *
 * When kubernetesDashboards feature is removed, delete the legacy/ folder entirely.
 */
export default function DashboardImportPage(props: Props) {
  if (config.featureToggles.kubernetesDashboards) {
    return <DashboardImportK8s {...props} />;
  }

  return <DashboardImportLegacy {...props} />;
}

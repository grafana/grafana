import { type GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { DashboardImportK8s } from './import/components/DashboardImportK8s';

type RouteParams = {};
type QueryParams = { gcomDashboardId?: string };

type Props = GrafanaRouteComponentProps<RouteParams, QueryParams>;

export default function DashboardImportPage(props: Props) {
  return <DashboardImportK8s {...props} />;
}

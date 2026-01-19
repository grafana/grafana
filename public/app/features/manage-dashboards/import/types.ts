import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';

export type DatasourceSelection = { uid: string; type: string; name?: string };

export type ImportFormDataV2 = SaveDashboardCommand<DashboardV2Spec> & Record<string, unknown>;

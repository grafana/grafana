import {
  DashboardV2,
  handyTestingSchema,
} from '../../../../../packages/grafana-schema/src/schema/dashboard/v2alpha0/dashboard.schema';
import { DashboardScene } from '../scene/DashboardScene';

export function transformSceneToSaveModelSchemaV2(scene: DashboardScene, isSnapshot = false): DashboardV2 {
  // placeholder for the implementation
  return handyTestingSchema;
}

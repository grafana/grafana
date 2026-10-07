import { type DashboardScene } from '../../scene/DashboardScene';
import {
  type DashboardActionMeta,
  DashboardBatchEditActionEndEvent,
  DashboardBatchEditActionStartEvent,
} from '../../sidebar/events';

export function startBatch(dashboard: DashboardScene, description: string, meta: DashboardActionMeta) {
  dashboard.publishEvent(new DashboardBatchEditActionStartEvent({ source: dashboard, description, meta }), true);
}

export function endBatch(dashboard: DashboardScene) {
  dashboard.publishEvent(new DashboardBatchEditActionEndEvent(), true);
}

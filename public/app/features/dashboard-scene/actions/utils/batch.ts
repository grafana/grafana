import { type DashboardScene } from '../../scene/DashboardScene';
import {
  type DashboardActionTracking,
  DashboardBatchEditActionEndEvent,
  DashboardBatchEditActionStartEvent,
} from '../../sidebar/events';

export function startBatch(dashboard: DashboardScene, description: string, tracking: DashboardActionTracking = {}) {
  dashboard.publishEvent(new DashboardBatchEditActionStartEvent({ source: dashboard, description, tracking }), true);
}

export function endBatch(dashboard: DashboardScene) {
  dashboard.publishEvent(new DashboardBatchEditActionEndEvent(), true);
}

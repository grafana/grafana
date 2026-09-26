import { type DashboardScene } from '../../scene/DashboardScene';
import { DashboardBatchEditActionEndEvent, DashboardBatchEditActionStartEvent } from '../../sidebar/events';

export function startBatch(dashboard: DashboardScene, description: string, actor?: string) {
  dashboard.publishEvent(new DashboardBatchEditActionStartEvent({ source: dashboard, description, actor }), true);
}

export function endBatch(dashboard: DashboardScene) {
  dashboard.publishEvent(new DashboardBatchEditActionEndEvent(), true);
}

import { type DashboardScene } from '../../scene/DashboardScene';
import { DashboardBatchEditActionEndEvent, DashboardBatchEditActionStartEvent } from '../../sidebar/events';

export function startBatch(dashboard: DashboardScene, description: string, batchActionId: string) {
  const meta = { actionId: `batch.${batchActionId}` } as const;
  dashboard.publishEvent(new DashboardBatchEditActionStartEvent({ source: dashboard, description, meta }), true);
}

export function endBatch(dashboard: DashboardScene) {
  dashboard.publishEvent(new DashboardBatchEditActionEndEvent(), true);
}

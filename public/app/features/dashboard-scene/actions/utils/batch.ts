import { type DashboardSceneLike } from '../../scene/types/dashboard';
import {
  type DashboardActionMeta,
  DashboardBatchEditActionEndEvent,
  DashboardBatchEditActionStartEvent,
} from '../../sidebar/events';

export function startBatch(dashboard: DashboardSceneLike, description: string, meta: DashboardActionMeta) {
  dashboard.publishEvent(new DashboardBatchEditActionStartEvent({ source: dashboard, description, meta }), true);
}

export function endBatch(dashboard: DashboardSceneLike) {
  dashboard.publishEvent(new DashboardBatchEditActionEndEvent(), true);
}

import { type DashboardMode } from '../scene/dashboardModes';

export type DashboardModeTrigger =
  | 'picker'
  | 'shortcut'
  | 'panel_menu'
  | 'assistant'
  | 'navigation'
  | 'composer'
  | 'restore';

/** `exited`: left edit mode without discarding. `abandoned`: navigated away or closed the tab while editing. */
export type DashboardEditPeriodOutcome = 'saved' | 'saved_as_copy' | 'discarded' | 'exited' | 'abandoned';

export type DashboardEditActors = 'none' | 'manual' | 'assistant' | 'mixed';

export interface DashboardEditSessionTracking {
  edit_session_id: string;
  edit_source: 'user' | 'assistant';
  mode: DashboardMode;
  had_manual_changes: boolean;
  had_assistant_changes: boolean;
  had_unattributed_changes: boolean;
  edit_actors: DashboardEditActors;
  elapsed_ms: number;
}

export function getEditActors(manual: boolean, assistant: boolean): DashboardEditActors {
  if (manual && assistant) {
    return 'mixed';
  }
  if (manual) {
    return 'manual';
  }
  return assistant ? 'assistant' : 'none';
}

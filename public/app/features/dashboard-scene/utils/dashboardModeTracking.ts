import { type DashboardMode } from '../scene/dashboardModes';

export type DashboardModeTrigger =
  | 'picker'
  | 'shortcut'
  | 'panel_menu'
  | 'manual_change'
  | 'assistant'
  | 'navigation'
  | 'restore';

export interface DashboardEditSessionTracking {
  edit_session_id: string;
  edit_source: 'user' | 'assistant';
  mode: DashboardMode;
  had_manual_changes: boolean;
  had_assistant_changes: boolean;
  elapsed_ms: number;
}

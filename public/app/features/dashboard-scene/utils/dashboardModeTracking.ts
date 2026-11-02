import { type DashboardMode } from '../scene/dashboardModes';

export type DashboardModeTrigger =
  | 'picker'
  | 'shortcut'
  | 'panel_menu'
  | 'manual_change'
  | 'assistant'
  | 'navigation'
  | 'composer'
  | 'composer_sidebar_closed'
  | 'composer_flag_off'
  | 'composer_plugin_exit'
  | 'restore';

/**
 * Why a Composer session ended. `navigation`: the scene deactivated. `manual_edit`: a manual-edit entry point
 * (the full editor, a panel or settings URL, discarding the edit session). `plugin_exit`: Assistant called `exit`.
 */
export type ComposerExitReason =
  | 'mode_picker'
  | 'sidebar_closed'
  | 'navigation'
  | 'flag_off'
  | 'manual_edit'
  | 'plugin_exit';

/** The `dashboards_mode_changed` trigger for leaving Composer; entering it reports `composer`. */
export const COMPOSER_EXIT_TRIGGERS: Record<ComposerExitReason, DashboardModeTrigger> = {
  mode_picker: 'picker',
  navigation: 'navigation',
  manual_edit: 'manual_change',
  sidebar_closed: 'composer_sidebar_closed',
  flag_off: 'composer_flag_off',
  plugin_exit: 'composer_plugin_exit',
};

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
  /** Whether a Composer session was open at any point during the edit period, and how many were. */
  composer_used: boolean;
  composer_sessions: number;
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

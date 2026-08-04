import { type SceneObjectUrlValues } from '@grafana/scenes';
import { DashboardSceneUrlSync } from 'app/features/dashboard-scene/scene/DashboardSceneUrlSync';

/**
 * A notebook's URL surface.
 *
 * DashboardSceneUrlSync owns six dashboard-chrome keys — `viewPanel`, `editPanel`, `editview`,
 * `shareView`, `inspect` and `autofitpanels` — none of which a notebook renders. Declaring none
 * of them is what makes the notebook's URL contract its own rather than the dashboard's.
 *
 * This does NOT drop time range, refresh or variable sync: those are owned by the objects that
 * hold them (SceneTimeRange syncs `from`/`to`/`timezone`/`time`/`time.window`, SceneRefreshPicker
 * syncs `refresh`, each variable syncs its own `var-*`), so they keep working untouched.
 *
 * Beyond being unrendered, the inherited handling is actively wrong here: unlike `editview`, the
 * `editPanel` branch has no `canEditDashboard()` guard, so `?editPanel=<key>` would call
 * `onEnterEditMode()` and flip a notebook into edit mode from the URL.
 *
 * Subclassed rather than reimplemented: DashboardSceneUrlSync has private members, so a
 * structurally-similar class would not be assignable to DashboardScene's `_urlSync` field.
 */
export class NotebookSceneUrlSync extends DashboardSceneUrlSync {
  public getKeys(): string[] {
    return [];
  }

  public getUrlState(): SceneObjectUrlValues {
    return {};
  }

  public updateFromUrl(): void {}
}

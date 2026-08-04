import type * as H from 'history';

import { type NavIndex, type NavModelItem } from '@grafana/data';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { type DashboardSceneState } from 'app/features/dashboard-scene/scene/types/dashboard';

import { NotebookSceneUrlSync } from './NotebookSceneUrlSync';

/**
 * A notebook is its own resource (Notebook in the dashboard.grafana.app group) rendered through
 * the dashboard scene runtime.
 *
 * It extends DashboardScene rather than reimplementing it because the panel runtime reaches the
 * root by identity, not by interface: getDashboardSceneFor() does `root instanceof DashboardScene`
 * and throws otherwise, and it is called from setDashboardPanelContext (for every panel, via
 * extendPanelContext), DashboardMacro, LibraryPanelBehavior and panelMenuBehavior. Subclassing
 * satisfies that check, and inherits plumbing that fails silently rather than loudly if
 * reimplemented wrong: enrichDataRequest (query metadata), window.__grafanaSceneContext (plugin
 * variable interpolation via template_srv), the DashboardSrv compatibility wrapper (read by many
 * panel plugins), DashboardVariableDependency (legacy panel refresh) and the assistant mutation
 * client.
 *
 * What it does NOT inherit is dashboard *behavior*: the edit-mode transaction, the change
 * tracker, the save drawer and the dashboard URL surface are all replaced below.
 *
 * IMPORTANT — this class must not add public members. SceneObject exposes
 * `get Component(): SceneComponent<this>`, and `SceneComponent<T>` takes `{ model: T }`, so under
 * strictFunctionTypes assigning a NotebookScene where a DashboardScene is expected requires
 * DashboardScene to be assignable to NotebookScene. One extra public method breaks that and the
 * scene stops being usable anywhere the dashboard runtime expects a DashboardScene. Notebook-only
 * behavior therefore goes in standalone functions taking the scene (see getNotebookSaveModel),
 * or in private members. Overrides are fine — they change no public shape.
 */
export class NotebookScene extends DashboardScene {
  public constructor(state: Partial<DashboardSceneState>) {
    super(state, 'v2');

    // Notebooks own their URL contract. See NotebookSceneUrlSync — time range, refresh and
    // variables are unaffected because they sync from their own objects.
    //
    // Assigned here rather than redeclared as a field on purpose: redeclaring a protected member
    // re-roots it in NotebookScene, which makes DashboardScene no longer assignable to
    // NotebookScene and (via Component's variance, see the note above) breaks passing this scene
    // to dashboard runtime code. Reassigning is safe — the base initializer has already run under
    // super(), and the url sync manager only reads _urlSync at activation.
    this._urlSync = new NotebookSceneUrlSync(this);

    this.addActivationHandler(() => {
      // A notebook autosaves per change, so the dashboard change tracker has no job here: it
      // diffs whole save models on a worker to drive isDirty for the save drawer, and it would
      // call the getSaveModel() below, which deliberately throws. _changeTracker is private on
      // the base and cannot be replaced, but pausing it is public.
      this.pauseTrackingChanges();
    });
  }

  /**
   * Entering edit mode on a notebook is a UI-affordance switch, nothing more: no _initialState
   * snapshot, no change tracking, no discard prompt, no dashboard edit-session analytics.
   *
   * The isEditing flag itself is kept rather than replaced because the assistant mutation API
   * calls this method directly before every mutation (see enterEditModeIfNeeded in
   * dashboard-scene/mutation-api/commands/types.ts). Overriding the method — instead of setting
   * the flag by hand — is what keeps that path working while changing what it means.
   *
   * Declared as a class property because the base declares it that way; a method would not
   * shadow it. Derived field initializers run after super(), so this wins, and the base
   * activation handler resolves it at activation time.
   */
  public onEnterEditMode = (_source: 'user' | 'assistant' = 'user') => {
    this.setState({ isEditing: true, editable: true });
    this.state.body.editModeChanged?.(true);
  };

  /**
   * Leaving edit mode never prompts: autosave has already persisted every change, so there is
   * nothing to discard and no unsaved-changes decision to put in front of the user.
   */
  public exitEditMode(_options: { skipConfirm: boolean; restoreInitialState?: boolean }) {
    this.setState({ isEditing: false });
    this.state.body.editModeChanged?.(false);
  }

  /**
   * Seals the dashboard save path. Returning a plausible-but-wrong DashboardV2Spec would be worse
   * than failing: it would silently write dashboard-shaped JSON to a Notebook resource.
   *
   * The notebook's own save boundary is the standalone getNotebookSaveModel(scene) in
   * ../serialization/getNotebookSaveModel — deliberately a function, not a method here. See the
   * note on this class about public surface.
   */
  public getSaveModel(): Dashboard | DashboardV2Spec {
    throw new Error('NotebookScene does not serialize to a dashboard spec — use getNotebookSaveModel()');
  }

  /**
   * The dashboard page nav builds dashboard URLs (/d/:uid) and appends View panel / Edit panel
   * crumbs. A notebook's breadcrumb is owned by NotebookScenePage, so this returns just the title.
   *
   * Signature matches the base exactly (unused params included) — see the public-surface note
   * above: a narrower override is still a shape change and breaks assignability to DashboardScene.
   */
  public getPageNav(_location: H.Location, _navIndex: NavIndex): NavModelItem {
    return { text: this.state.title };
  }
}

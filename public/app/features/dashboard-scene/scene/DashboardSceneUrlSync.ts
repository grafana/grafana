import { type Unsubscribable } from 'rxjs';

import { type SceneObjectUrlSyncHandler, type SceneObjectUrlValues, type VizPanel } from '@grafana/scenes';

import { openPanelEditor } from '../panel-edit/openPanelEditor';
import { createDashboardEditViewFor } from '../settings/createDashboardEditViewFor';
import { ShareDrawer } from '../sharing/ShareDrawer/ShareDrawer';
import { findEditPanel, getLibraryPanelBehavior } from '../utils/utils';

import { type DashboardScene } from './DashboardScene';
import { type LibraryPanelBehavior } from './LibraryPanelBehavior';
import { UNCONFIGURED_PANEL_PLUGIN_ID } from './UnconfiguredPanel';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { refuseWhilePlanning } from './refuseWhilePlanning';
import { type DashboardSceneState } from './types/dashboard';

export class DashboardSceneUrlSync implements SceneObjectUrlSyncHandler {
  /**
   * Panel id of an editor that is open as far as the URL is concerned but has no pane yet: the id
   * resolved to an unloaded library panel, or a rebuild dropped the pane before re-resolving it.
   * `state.editPanel` is unset for that whole window, so without the hold the state change that
   * closes the pane writes `?editPanel=` out, and a reload before the re-open lands (or a library
   * panel whose fetch fails) loses the editor for good.
   */
  private _heldEditPanelId?: string;
  private _libPanelSub?: Unsubscribable;

  constructor(private _scene: DashboardScene) {}

  getKeys(): string[] {
    return ['inspect', 'viewPanel', 'editPanel', 'editview', 'autofitpanels', 'shareView', 'drow'];
  }

  getUrlState(): SceneObjectUrlValues {
    const state = this._scene.state;

    return {
      autofitpanels: this.getAutoFitPanels(),
      viewPanel: state.viewPanel,
      editview: state.editview?.getUrlKey(),
      // The hold only stands while the dashboard is still editing. Leaving edit mode clears the
      // param through its own navigation, and reporting the held id here would put it back.
      editPanel: state.editPanel?.getUrlKey() || (state.isEditing ? this._heldEditPanelId : undefined),
      shareView: state.shareView,
    };
  }

  /**
   * Hold `?editPanel=` in the URL across a scene rebuild, for a caller that is about to drop the
   * pane and re-resolve the id against the tree it swaps in.
   */
  public retainEditPanelAcrossRebuild(panelId: string) {
    this._heldEditPanelId = panelId;
  }

  private _releaseEditPanel() {
    if (this._heldEditPanelId !== undefined) {
      this._scene.cancelPendingViews();
    }
    this._libPanelSub?.unsubscribe();
    this._libPanelSub = undefined;
    this._heldEditPanelId = undefined;
  }

  private getAutoFitPanels(): string | undefined {
    if (this._scene.state.body instanceof DefaultGridLayoutManager) {
      return this._scene.state.body.state.grid.state.UNSAFE_fitPanels ? 'true' : undefined;
    }

    return undefined;
  }

  updateFromUrl(values: SceneObjectUrlValues): void {
    const { viewPanel, isEditing, editPanel, editview, shareView } = this._scene.state;
    const update: Partial<DashboardSceneState> = {};
    let panelToEdit: VizPanel | undefined;

    // Reachable directly via ?editview=, independent of any settings entry point: without this
    // check, the branch below calls onEnterEditMode() unconditionally when not already editing,
    // undoing the invariant a plan preview depends on (see refuseWhilePlanning).
    if (typeof values.editview === 'string' && this._scene.canEditDashboard() && !refuseWhilePlanning(this._scene)) {
      update.editview = createDashboardEditViewFor(values.editview);

      // If we are not in editing (for example after full page reload)
      if (!isEditing) {
        if (this._scene.state.editable) {
          // Not sure what is best to do here.
          // The reason for the timeout is for this change to happen after the url sync has completed
          setTimeout(() => this._scene.onEnterEditMode());
        } else {
          update.editview = undefined;
        }
      }
    } else if (editview && values.hasOwnProperty('editview')) {
      update.editview = undefined;
    }

    // Guarded like editview/editPanel/shareView below: a preview panel has no menu (see
    // renderPlan.ts), but ?viewPanel= reaches the same view-panel pane directly. Its Quick
    // toggles section is gated on the plugin's viewPanelOptions, not on isPlanning().
    if (typeof values.viewPanel === 'string' && !refuseWhilePlanning(this._scene)) {
      update.viewPanel = values.viewPanel;
    } else if (typeof values.viewPanel === 'string') {
      update.viewPanel = undefined;
    } else if (viewPanel && values.viewPanel === null) {
      update.viewPanel = undefined;
    }

    // Same reason as editview above: the branch below calls onEnterEditMode() unconditionally
    // if not already editing, so this must be checked first.
    if (typeof values.editPanel === 'string' && !refuseWhilePlanning(this._scene)) {
      const panel = findEditPanel(this._scene, values.editPanel);

      if (!panel) {
        console.warn(`Panel ${values.editPanel} not found`);
        // A rebuild that dropped the panel: release the hold and force the state change that
        // writes `?editPanel=` out, or the URL keeps naming a panel the tree does not have.
        const wasHeld = this._heldEditPanelId !== undefined;
        this._releaseEditPanel();
        if (wasHeld) {
          this._scene.setState({ editPanel: undefined });
        }
        return;
      }

      // We cannot simultaneously be in edit and view panel state.
      if (this._scene.state.viewPanel) {
        update.viewPanel = undefined;
      }

      // If we are not in editing (for example after full page reload)
      if (!isEditing) {
        // Entering edit mode publishes state before the editor exists; keep its URL through that update.
        this._heldEditPanelId = values.editPanel;
        this._scene.onEnterEditMode();
      }

      const libPanelBehavior = getLibraryPanelBehavior(panel);
      if (libPanelBehavior && !libPanelBehavior?.state.isLoaded) {
        this._waitForLibPanelToLoadBeforeEnteringPanelEdit(values.editPanel, libPanelBehavior);
        return;
      }

      panelToEdit = panel;
    } else if (typeof values.editPanel === 'string') {
      // Refused while planning: clear the param rather than leaving it to keep re-triggering on
      // every sync tick.
      update.editPanel = undefined;
    } else if (values.editPanel === null) {
      // Closing the pane supersedes a re-open still waiting on a library panel.
      this._releaseEditPanel();

      if (editPanel) {
        update.editPanel = undefined;
      }
    }

    // Share is guarded elsewhere too (keyboardShortcuts.ts; the menu route is closed since a
    // preview panel has no menu at all). ?shareView=snapshot would otherwise let a placeholder's
    // synthetic sample data leave the preview as a durable, real-looking artifact.
    if (typeof values.shareView === 'string' && !refuseWhilePlanning(this._scene)) {
      update.shareView = values.shareView;
      update.overlay = new ShareDrawer({
        shareView: values.shareView,
      });
    } else if (typeof values.shareView === 'string') {
      update.shareView = undefined;
    } else if (shareView && values.shareView === null) {
      update.overlay = undefined;
      update.shareView = undefined;
    }

    const layout = this._scene.state.body;
    if (layout instanceof DefaultGridLayoutManager) {
      const UNSAFE_fitPanels = typeof values.autofitpanels === 'string';

      if (!!layout.state.grid.state.UNSAFE_fitPanels !== UNSAFE_fitPanels) {
        layout.state.grid.setState({ UNSAFE_fitPanels });
      }
    }

    if (Object.keys(update).length > 0) {
      this._scene.setState(update);
    }

    // Apply synchronous URL changes first so they do not cancel the editor requested by this same update.
    if (panelToEdit && typeof values.editPanel === 'string') {
      this._enterPanelEdit(values.editPanel, panelToEdit);
    }

    if (typeof values.drow === 'string') {
      this._scene.scrollToRow(values.drow);
    }
  }

  /**
   * Temporary solution, with some refactoring of PanelEditor we can remove this
   */
  private _waitForLibPanelToLoadBeforeEnteringPanelEdit(panelId: string, libPanel: LibraryPanelBehavior) {
    this._libPanelSub?.unsubscribe();
    this._heldEditPanelId = panelId;

    const sub = libPanel.subscribeToState((state) => {
      if (state.isLoaded) {
        sub.unsubscribe();
        if (this._libPanelSub === sub) {
          this._libPanelSub = undefined;
          this._heldEditPanelId = undefined;
        }
        this._openPanelEditById(panelId);
      }
    });

    this._libPanelSub = sub;
  }

  /**
   * Open panel edit for an id resolved against the CURRENT tree.
   *
   * The wait above outlives the panel it was started for. A scene rebuild (APPLY_SPEC, the json and
   * code editors) replaces the whole layout tree, and `state.editPanel` is unset for the duration of
   * the wait, so nothing else can re-open the pane afterwards. Resolving the id again is what lets
   * the wait survive that: opening the editor on the panel it captured would instead leave the pane
   * driving a panel the dashboard no longer contains. If the panel it lands on is itself an unloaded
   * library panel, it waits once more, on the behavior the live tree holds.
   */
  private _openPanelEditById(panelId: string) {
    // The pane is closed for the whole wait, so anything the user does meanwhile is the newer
    // intent: leaving edit mode, or opening a different panel, would be silently undone by
    // re-opening on the id this wait captured.
    if (!this._scene.state.isEditing || this._scene.state.editPanel) {
      this._releaseEditPanel();
      return;
    }

    const panel = findEditPanel(this._scene, panelId);
    if (!panel) {
      return;
    }

    const libPanelBehavior = getLibraryPanelBehavior(panel);
    if (libPanelBehavior && !libPanelBehavior.state.isLoaded) {
      this._waitForLibPanelToLoadBeforeEnteringPanelEdit(panelId, libPanelBehavior);
      return;
    }

    this._enterPanelEdit(panelId, panel);
  }

  /**
   * The editor is code split, so the pane only lands in a follow-up state update once the chunk has
   * loaded. The hold stands for that window, the same way it does for the library panel wait: any
   * state change in between would otherwise write `?editPanel=` out of the URL.
   */
  private _enterPanelEdit(panelId: string, panel: VizPanel) {
    this._libPanelSub?.unsubscribe();
    this._libPanelSub = undefined;
    this._heldEditPanelId = panelId;

    openPanelEditor(this._scene, panel, panel.state.pluginId === UNCONFIGURED_PANEL_PLUGIN_ID).then(() => {
      if (this._heldEditPanelId === panelId) {
        this._heldEditPanelId = undefined;
      }
    });
  }
}

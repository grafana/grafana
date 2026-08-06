import { isEqual } from 'lodash';

import {
  NewSceneObjectAddedEvent,
  type SceneObject,
  SceneObjectBase,
  SceneObjectRemovedEvent,
  sceneGraph,
} from '@grafana/scenes';
import { type ElementSelectionContextItem, type ElementSelectionOnSelectOptions } from '@grafana/ui';
import { getLayoutType } from 'app/features/dashboard/utils/tracking';

import {
  type DashboardEditActionsHistoryHost,
  DashboardEditActionsHistory,
} from '../actions/DashboardEditActionsHistory';
import { getEditableElementFor } from '../actions/utils/getEditableElementFor';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { getRepeatCloneSourceKey } from '../utils/clone';
import { DashboardInteractions } from '../utils/interactions';
import { getDefaultVizPanel, getLayoutForObject, getDashboardSceneFor } from '../utils/utils';

import { ElementEditPane } from './ElementEditPane';
import {
  ConditionalRenderingChangedEvent,
  type DashboardEditActionEvent,
  NewObjectAddedToCanvasEvent,
  ObjectRemovedFromCanvasEvent,
  ObjectsReorderedOnCanvasEvent,
  RepeatsUpdatedEvent,
} from './events';
import { DashboardOutline } from './outline/DashboardOutline';
import { type DashboardSidebarPane, type DashboardSidebarLike, type DashboardSidebarState } from './types';

export class DashboardSidebar extends SceneObjectBase<DashboardSidebarState> implements DashboardSidebarLike {
  public constructor(state?: Partial<DashboardSidebarState>) {
    const editHistory = state?.editHistory ?? new DashboardEditActionsHistory();

    super({
      selectionContext: {
        enabled: false,
        selected: [],
        onSelect: (item, options) => this.selectElement(item, options),
        onClear: () => this.clearSelection(),
      },
      isNewElement: false,
      editHistory,
      outlinePane: state?.outlinePane ?? new DashboardOutline({}),
    });

    this.state.editHistory.setHost(this.createHistoryHost());
    this.addActivationHandler(this.onActivate.bind(this));
  }

  private panelEditAction?: DashboardEditActionEvent;

  public setPanelEditAction(editAction: DashboardEditActionEvent) {
    this.panelEditAction = editAction;
  }

  public clone(withState: Partial<DashboardSidebarState>): this {
    // Clone without any undo/redo history
    const editHistory = new DashboardEditActionsHistory();
    const cloned = super.clone({ ...withState, editHistory });
    cloned.state.editHistory.setHost(cloned.createHistoryHost());
    return cloned;
  }

  private createHistoryHost(): DashboardEditActionsHistoryHost {
    return {
      onObjectAdded: (obj) => this.newObjectAddedToCanvas(obj),
      clearSelection: () => this.clearSelection(),
      selectObject: (obj, options) => this.selectObject(obj, options),
      getSelectedObject: () => this.getSelectedObject(),
      fixSelectionOfRemovedObject: () => this.fixSelectionOfRemovedObject(),
    };
  }

  private onActivate() {
    const dashboard = getDashboardSceneFor(this);
    // editHistory is not a $behavior / rendered child, so activate it with the sidebar
    const deactivateHistory = this.state.editHistory.activate();

    if (dashboard.state.isEditing) {
      this.enableSelection();
    }

    this._subs.add(
      dashboard.subscribeToEvent(NewObjectAddedToCanvasEvent, ({ payload }) => {
        this.newObjectAddedToCanvas(payload);
      })
    );

    this._subs.add(
      dashboard.subscribeToEvent(ObjectRemovedFromCanvasEvent, ({ payload }) => {
        this.clearSelection();
      })
    );

    this._subs.add(
      dashboard.subscribeToEvent(ObjectsReorderedOnCanvasEvent, ({ payload }) => {
        this.forceRender();
      })
    );

    this._subs.add(
      dashboard.subscribeToEvent(ConditionalRenderingChangedEvent, ({ payload }) => {
        this.forceRender();
      })
    );

    this._subs.add(
      dashboard.subscribeToEvent(RepeatsUpdatedEvent, () => {
        this.forceRender();
      })
    );

    if (this.panelEditAction) {
      this.performPanelEditAction(this.panelEditAction);
      this.panelEditAction = undefined;
    }

    return () => {
      deactivateHistory();
      if (this.state.selectionContext.selected.length) {
        this.clearSelection(true);
      }
      this.disableSelection();
    };
  }

  private performPanelEditAction(action: DashboardEditActionEvent) {
    // Some layout items are not yet active when leaving panel edit, let's wait for them to activate
    if (!action.payload.source.isActive) {
      trySwitchingToSourceTab(action.payload.source);
      setTimeout(() => this.performPanelEditAction(action));
      return;
    }

    action.payload.source.publishEvent(action, true);
  }

  public undoAction() {
    this.state.editHistory.undoAction();
  }

  public redoAction() {
    this.state.editHistory.redoAction();
  }

  public enableSelection() {
    if (this.state.selectionContext.enabled) {
      return;
    }

    this.setState({ selectionContext: { ...this.state.selectionContext, enabled: true } });
  }

  public disableSelection() {
    if (!this.state.selectionContext.enabled) {
      return;
    }

    this.setState({
      selectionContext: { ...this.state.selectionContext, selected: [], enabled: false },
      openPane: undefined,
    });
  }

  private selectElement(element: ElementSelectionContextItem, options: ElementSelectionOnSelectOptions) {
    let obj = sceneGraph.findByKey(this, element.id);
    if (!obj) {
      console.warn('Cannot find element by key="%s"!', element.id);
      return;
    }

    const sourceKey = getRepeatCloneSourceKey(obj);
    if (sourceKey) {
      obj = sceneGraph.findByKey(this, sourceKey);
      if (!obj) {
        console.warn('Cannot find element by source key="%s"!', sourceKey);
        return;
      }
    }

    this.selectObject(obj, options);
  }

  public selectObject(obj: SceneObject, { multi, force }: ElementSelectionOnSelectOptions = {}) {
    const id = obj.state.key!;
    const hasItem = this.state.selectionContext.selected.find((i) => i.id === id);

    // Special logic for tabs only select tab of open pane is not already open or tab is already active
    if (!force && !this.state.openPane && obj instanceof TabItem && !obj.isCurrentTab()) {
      return;
    }

    let selectedDisconnectedObject: SceneObject | undefined;
    if (obj.getRoot() !== this.getRoot() || obj.parent === this) {
      selectedDisconnectedObject = obj;
    }

    // If current open pane is not showing selected element, then we should maintain selection (force = true) which disables selection toggling
    if (this.state.openPane?.getId() !== 'element') {
      force = true;
    }

    if (multi) {
      if (hasItem) {
        // Remove item unless force is true
        if (!force) {
          this.updateSelection(
            this.state.selectionContext.selected.filter((i) => i.id !== id),
            selectedDisconnectedObject
          );
        }
      } else {
        this.updateSelection([...this.state.selectionContext.selected, { id }], selectedDisconnectedObject);
      }
    } else {
      if (hasItem && !force) {
        this.updateSelection([], selectedDisconnectedObject);
      } else {
        this.updateSelection([{ id }], selectedDisconnectedObject);
      }
    }
  }

  public fixSelectionOfRemovedObject() {
    if (this.state.previousState) {
      this.goBackToPrevious();
    } else {
      this.clearSelection(true);
    }
  }

  public goBackToPrevious() {
    if (!this.state.previousState) {
      return;
    }

    this.setState({
      selectionContext: this.state.previousState.selectionContext,
      openPane: this.state.previousState.openPane,
      selectedDisconnectedObject: this.state.previousState.selectedDisconnectedObject,
      previousState: this.state.previousState.previousState,
    });

    if (this.state.openPane?.getId() === 'element' && this.state.selectionContext.selected.length === 1) {
      const selectedObj = this.getSelectedObject();
      if (selectedObj) {
        const element = getEditableElementFor(selectedObj);
        element?.scrollIntoView?.();
      }
    }
  }

  private updateSelection(selected: ElementSelectionContextItem[], selectedDisconnectedObject?: SceneObject) {
    // onBlur events are not fired on unmount and some sidebar inputs have important onBlur events
    // This make sure they fire before unmounting
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const newState: DashboardSidebarState = {
      ...this.state,
      selectionContext: { ...this.state.selectionContext, selected },
      openPane: selected.length ? new ElementEditPane({}) : undefined,
      isNewElement: false,
      selectedDisconnectedObject,
    };

    this.setState({
      ...newState,
      previousState: selected.length ? getStateForPaneHistory(this.state, newState) : undefined,
    });
  }

  /**
   * Look-up selected object by key. If key is not provided, will return object based on current selection.
   * @param key of the object
   * @returns
   */
  public getSelectedObject(key?: string): SceneObject | undefined {
    if (key) {
      // Not using findByKey here as it requires try catch in case object is not found
      return sceneGraph.findObject(this, (obj) => obj.state.key === key) ?? undefined;
    }

    if (this.state.selectedDisconnectedObject) {
      return this.state.selectedDisconnectedObject;
    }

    if (this.state.selectionContext.selected.length === 0) {
      return undefined;
    }

    // Not using findByKey here as it requires try catch in case object is not found
    return (
      sceneGraph.findObject(this, (obj) => obj.state.key === this.state.selectionContext.selected[0].id) ?? undefined
    );
  }

  /**
   * @param force If force = true it will clear selection even when docked
   * @returns
   */
  public clearSelection(force = false) {
    if (!this.state.selectionContext.selected.length) {
      return;
    }

    // If we are docked then clearing selection should select dashboard itself
    // Unless the user explicitly closes pane
    if (this.state.isDocked && !force) {
      const dashboard = getDashboardSceneFor(this);
      if (this.getSelectedObject() !== dashboard) {
        this.selectObject(dashboard);
      }
      return;
    }

    this.updateSelection([]);
  }

  public openPane(openPane: DashboardSidebarPane) {
    if (this.state.openPane?.getId() === openPane.getId()) {
      this.setState({ openPane: undefined });
      return;
    }

    this.setState({ openPane, previousState: getStateForPaneHistory(this.state) });

    // UrlSyncManager subscribes to this and syncs url state with pane state
    this.publishEvent(new NewSceneObjectAddedEvent(openPane), true);
  }

  public closePane() {
    if (this.state.selectionContext.selected.length) {
      this.clearSelection(true);
    }

    if (this.state.openPane) {
      const openPane = this.state.openPane;
      this.setState({ openPane: undefined });

      // UrlSyncManager subscribes to this and removes the pane url state from url
      this.publishEvent(new SceneObjectRemovedEvent(openPane), true);
    }
  }

  private newObjectAddedToCanvas(obj: SceneObject) {
    this.selectObject(obj, { force: true });
    this.setState({ isNewElement: true });
  }

  public addNewPanel(target: SceneObject | undefined) {
    const panel = getDefaultVizPanel();
    const dashboard = getDashboardSceneFor(this);

    if (target) {
      const layout = getLayoutForObject(target) ?? dashboard;
      layout.addPanel(panel);
    } else {
      dashboard.addPanel(panel);
    }

    DashboardInteractions.trackAddPanelClick('sidebar', getLayoutType(target));
  }

  public pastePanel(target: SceneObject | undefined) {
    const dashboard = getDashboardSceneFor(this);

    if (target) {
      const layout = getLayoutForObject(target) ?? dashboard;
      layout.pastePanel();
    } else {
      dashboard.pastePanel();
    }
  }
}

function trySwitchingToSourceTab(source: SceneObject) {
  if (source.parent === undefined) {
    return;
  }

  if (source.parent instanceof TabItem) {
    const tab = source.parent;
    const tabsLayout = source.parent.getParentLayout();
    if (tabsLayout.state.currentTabSlug !== tab.getSlug()) {
      tabsLayout.switchToTab(tab);
    }
  } else {
    trySwitchingToSourceTab(source.parent);
  }
}

function getStateForPaneHistory(
  currentState: DashboardSidebarState | undefined,
  newState?: DashboardSidebarState
): DashboardSidebarState | undefined {
  if (!currentState || !currentState.openPane) {
    return undefined;
  }

  if (currentState.openPane?.excludeFromHistory) {
    return getStateForPaneHistory(currentState.previousState!, newState);
  }

  // If newState is same dont create an duplcate history entry
  if (
    newState &&
    newState.openPane?.getId() === currentState.openPane?.getId() &&
    isEqual(newState.selectionContext.selected, currentState.selectionContext.selected)
  ) {
    return getStateForPaneHistory(currentState.previousState, newState);
  }

  return currentState;
}

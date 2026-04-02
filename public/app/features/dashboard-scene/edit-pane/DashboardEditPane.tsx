import { type SceneObject, SceneObjectBase, type SceneObjectState, sceneGraph } from '@grafana/scenes';
import {
  type ElementSelectionContextItem,
  type ElementSelectionContextState,
  type ElementSelectionOnSelectOptions,
} from '@grafana/ui';
import { getLayoutType } from 'app/features/dashboard/utils/tracking';

import { TabItem } from '../scene/layout-tabs/TabItem';
import { getRepeatCloneSourceKey } from '../utils/clone';
import { DashboardInteractions } from '../utils/interactions';
import { getDefaultVizPanel, getLayoutForObject, getDashboardSceneFor } from '../utils/utils';

import {
  ConditionalRenderingChangedEvent,
  DashboardEditActionEvent,
  type DashboardEditActionEventPayload,
  DashboardStateChangedEvent,
  NewObjectAddedToCanvasEvent,
  ObjectRemovedFromCanvasEvent,
  ObjectsReorderedOnCanvasEvent,
  RepeatsUpdatedEvent,
} from './shared';
import { type EditPaneSelectionActions } from './types';

export interface DashboardEditPaneState extends SceneObjectState {
  selectionContext: ElementSelectionContextState;

  undoStack: DashboardEditActionEventPayload[];
  redoStack: DashboardEditActionEventPayload[];
  openPane?: DashboardSidebarPaneName;
  isDocked?: boolean;
}

export type DashboardSidebarPaneName = 'element' | 'outline' | 'filters' | 'add' | 'code';

export class DashboardEditPane extends SceneObjectBase<DashboardEditPaneState> implements EditPaneSelectionActions {
  public constructor() {
    super({
      selectionContext: {
        enabled: false,
        selected: [],
        onSelect: (item, options) => this.selectElement(item, options),
        onClear: () => this.clearSelection(),
      },
      undoStack: [],
      redoStack: [],
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private panelEditAction?: DashboardEditActionEvent;

  public setPanelEditAction(editAction: DashboardEditActionEvent) {
    this.panelEditAction = editAction;
  }

  public clone(withState: Partial<DashboardEditPaneState>): this {
    // Clone without any undo/redo history
    return super.clone({ ...withState, redoStack: [], undoStack: [] });
  }

  private onActivate() {
    const dashboard = getDashboardSceneFor(this);

    if (dashboard.state.isEditing) {
      this.enableSelection();
    }

    this._subs.add(
      dashboard.subscribeToEvent(DashboardEditActionEvent, ({ payload }) => {
        this.handleEditAction(payload);
      })
    );

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

  /**
   * Handles all edit actions
   * Adds to undo history and selects new object
   * @param payload
   */
  private handleEditAction(action: DashboardEditActionEventPayload) {
    // Clear redo stack when user performs a new action
    // Otherwise things can get into very broken states
    if (this.state.redoStack.length > 0) {
      this.setState({ redoStack: [] });
    }

    this.performAction(action);

    this.setState({ undoStack: [...this.state.undoStack, action] });
  }

  /**
   * Removes last action from undo stack and adds it to redo stack.
   */
  public undoAction() {
    const undoStack = this.state.undoStack.slice();
    const action = undoStack.pop();
    if (!action) {
      return;
    }

    action.undo();
    action.source.publishEvent(new DashboardStateChangedEvent({ source: action.source }), true);

    if (action.addedObject) {
      this.clearSelection();
    }

    if (action.movedObject) {
      this.selectObject(action.movedObject, action.movedObject.state.key!, { force: true });
    }

    if (action.removedObject) {
      this.newObjectAddedToCanvas(action.removedObject);
    }

    this.setState({ undoStack, redoStack: [...this.state.redoStack, action] });
  }

  /**
   * Some edit actions also require clearing selection or selecting new objects
   */
  private performAction(action: DashboardEditActionEventPayload) {
    action.perform();
    action.source.publishEvent(new DashboardStateChangedEvent({ source: action.source }), true);

    if (action.addedObject) {
      this.newObjectAddedToCanvas(action.addedObject);
    }

    if (action.movedObject) {
      this.selectObject(action.movedObject, action.movedObject.state.key!, { force: true });
    }

    if (action.removedObject && !action.addedObject) {
      this.clearSelection();
    }
  }

  /**
   * Removes last action from redo stack and adds it to undo stack.
   */
  public redoAction() {
    const redoStack = this.state.redoStack.slice();
    const action = redoStack.pop();
    if (!action) {
      return;
    }

    this.performAction(action);

    this.setState({ redoStack, undoStack: [...this.state.undoStack, action] });
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

    this.selectObject(obj, obj.state.key!, options);
  }

  public selectObject(obj: SceneObject, id: string, { multi, force }: ElementSelectionOnSelectOptions = {}) {
    const hasItem = this.state.selectionContext.selected.find((i) => i.id === id);

    if (multi) {
      if (hasItem) {
        this.setState({
          selectionContext: {
            ...this.state.selectionContext,
            selected: this.state.selectionContext.selected.filter((i) => i.id !== id),
          },
        });
      } else {
        this.setState({
          selectionContext: {
            ...this.state.selectionContext,
            selected: [...this.state.selectionContext.selected, { id }],
          },
          openPane: 'element',
        });
      }
    } else {
      if (hasItem) {
        this.setState({ selectionContext: { ...this.state.selectionContext, selected: [] }, openPane: undefined });
      } else {
        this.setState({
          selectionContext: { ...this.state.selectionContext, selected: [{ id }] },
          openPane: 'element',
        });
      }
    }
  }

  public getSelectedObject(): SceneObject | undefined {
    if (this.state.selectionContext.selected.length === 0) {
      return undefined;
    }

    return sceneGraph.findByKey(this, this.state.selectionContext.selected[0].id);
  }

  /**
   * @param force If force = true it will clear selection even when docked
   * @returns
   */
  public clearSelection(force = false) {
    if (!this.state.selectionContext.selected.length) {
      return;
    }

    this.setState({ selectionContext: { ...this.state.selectionContext, selected: [] }, openPane: undefined });

    // If we are docked then clearing selection should select dashboard itself
    // Unless the user explicitly closes pane
    if (this.state.isDocked && !force) {
      const dashboard = getDashboardSceneFor(this);
      if (obj !== dashboard) {
        this.selectObject(dashboard, dashboard.state.key!);
      }
      return;
    }

    // this.updateSelection(undefined, []);
  }

  public openPane(openPane: DashboardSidebarPaneName) {
    if (this.state.selectionContext.selected.length) {
      this.clearSelection(true);
    }

    if (openPane === this.state.openPane) {
      this.setState({ openPane: undefined });
    } else {
      this.setState({ openPane });
    }
  }

  public closePane() {
    if (this.state.selectionContext.selected.length) {
      this.clearSelection(true);
    }

    if (this.state.openPane) {
      this.setState({ openPane: undefined });
    }
  }

  private newObjectAddedToCanvas(obj: SceneObject) {
    this.selectObject(obj, obj.state.key!);
    //this.state.selection?.markAsNewElement();
  }

  public addNewPanel(targetElement?: SceneObject) {
    const panel = getDefaultVizPanel();
    const dashboard = getDashboardSceneFor(this);
    if (targetElement) {
      const layout = getLayoutForObject(targetElement) ?? dashboard;
      layout.addPanel(panel);
    } else {
      dashboard.addPanel(panel);
    }
    DashboardInteractions.trackAddPanelClick('sidebar', getLayoutType(targetElement));
  }

  public pastePanel(targetElement?: SceneObject, source: 'sidebar' | 'editPaneHeader' = 'sidebar') {
    const dashboard = getDashboardSceneFor(this);
    if (targetElement) {
      const layout = getLayoutForObject(targetElement) ?? dashboard;
      layout.pastePanel();
    } else {
      dashboard.pastePanel();
    }
    DashboardInteractions.trackPastePanelClick(source, getLayoutType(targetElement), 'click');
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

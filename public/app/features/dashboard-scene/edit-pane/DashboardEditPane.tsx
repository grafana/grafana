import { SceneObjectState, SceneObjectBase, SceneObject, sceneGraph, VizPanel } from '@grafana/scenes';
import {
  ElementSelectionContextItem,
  ElementSelectionContextState,
  ElementSelectionOnSelectOptions,
} from '@grafana/ui';

import { isDashboardLayoutItem } from '../scene/types/DashboardLayoutItem';
import { containsCloneKey, getLastKeyFromClone, isInCloneChain } from '../utils/clone';
import { findEditPanel, getDashboardSceneFor } from '../utils/utils';

import { ElementSelection } from './ElementSelection';
import {
  ConditionalRenderingChangedEvent,
  DashboardEditActionEvent,
  DashboardEditActionEventPayload,
  DashboardStateChangedEvent,
  NewObjectAddedToCanvasEvent,
  ObjectRemovedFromCanvasEvent,
  ObjectsReorderedOnCanvasEvent,
} from './shared';

export interface DashboardEditPaneState extends SceneObjectState {
  selection?: ElementSelection;
  selectionContext: ElementSelectionContextState;

  undoStack: DashboardEditActionEventPayload[];
  redoStack: DashboardEditActionEventPayload[];
}

export class DashboardEditPane extends SceneObjectBase<DashboardEditPaneState> {
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

  private onActivate() {
    const dashboard = getDashboardSceneFor(this);

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

    // Notify repeaters that something changed
    if (action.source instanceof VizPanel) {
      const layoutElement = action.source.parent!;

      if (isDashboardLayoutItem(layoutElement) && layoutElement.editingCompleted) {
        layoutElement.editingCompleted(true);
      }
    }
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

    /**
     * Some edit actions also require clearing selection or selecting new objects
     */
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

    if (action.removedObject) {
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
    // Enable element selection
    this.setState({ selectionContext: { ...this.state.selectionContext, enabled: true } });
  }

  public disableSelection() {
    this.setState({
      selectionContext: { ...this.state.selectionContext, selected: [], enabled: false },
      selection: undefined,
    });
  }

  private selectElement(element: ElementSelectionContextItem, options: ElementSelectionOnSelectOptions) {
    // We should not select clones
    if (isInCloneChain(element.id)) {
      if (options.multi) {
        return;
      }

      this.clearSelection();
      return;
    }

    let obj = sceneGraph.findByKey(this, element.id);
    if (obj) {
      if (obj instanceof VizPanel && containsCloneKey(getLastKeyFromClone(element.id))) {
        const sourceVizPanel = findEditPanel(this, element.id);
        if (sourceVizPanel) {
          obj = sourceVizPanel;
        }
      }
      this.selectObject(obj, element.id, options);
    }
  }

  public getSelection(): SceneObject | SceneObject[] | undefined {
    return this.state.selection?.getSelection();
  }

  public selectObject(obj: SceneObject, id: string, { multi, force }: ElementSelectionOnSelectOptions = {}) {
    if (!force) {
      if (multi) {
        if (this.state.selection?.hasValue(id)) {
          this.removeMultiSelectedObject(id);
          return;
        }
      } else {
        if (this.state.selection?.getFirstObject() === obj) {
          this.clearSelection();
          return;
        }
      }
    }

    const elementSelection = this.state.selection ?? new ElementSelection([[id, obj.getRef()]]);

    const { selection, contextItems: selected } = elementSelection.getStateWithValue(id, obj, !!multi);

    this.updateSelection(new ElementSelection(selection), selected);
  }

  private removeMultiSelectedObject(id: string) {
    if (!this.state.selection) {
      return;
    }

    const { entries, contextItems: selected } = this.state.selection.getStateWithoutValueAt(id);

    if (entries.length === 0) {
      this.clearSelection();
      return;
    }

    this.updateSelection(new ElementSelection([...entries]), selected);
  }

  private updateSelection(selection: ElementSelection | undefined, selected: ElementSelectionContextItem[]) {
    // onBlur events are not fired on unmount and some edit pane inputs have important onBlur events
    // This make sure they fire before unmounting
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    this.setState({ selection, selectionContext: { ...this.state.selectionContext, selected } });
  }

  public clearSelection() {
    if (!this.state.selection) {
      return;
    }

    this.updateSelection(undefined, []);
  }

  private newObjectAddedToCanvas(obj: SceneObject) {
    this.selectObject(obj, obj.state.key!);
    this.state.selection?.markAsNewElement();
  }
}

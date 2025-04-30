import { SceneObjectState, SceneObjectBase, SceneObject, sceneGraph, VizPanel } from '@grafana/scenes';
import {
  ElementSelectionContextItem,
  ElementSelectionContextState,
  ElementSelectionOnSelectOptions,
} from '@grafana/ui';

import { isDashboardLayoutItem } from '../scene/types/DashboardLayoutItem';
import { containsCloneKey, getOriginalKey, isInCloneChain } from '../utils/clone';
import { getDashboardSceneFor } from '../utils/utils';

import { ElementSelection } from './ElementSelection';
import {
  ConditionalRenderingChangedEvent,
  DashboardEditActionEvent,
  DashboardEditActionEventPayload,
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
    this.state.undoStack.push(action);

    const { sceneObj } = action;

    this.performAction(action);

    // Notify repeaters that something changed
    if (sceneObj instanceof VizPanel) {
      const layoutElement = sceneObj.parent!;

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

    /**
     * Some edit actions also require clearing selection or selecting new objects
     */
    switch (action.type) {
      case 'canvas-element-added':
        this.clearSelection();
        break;
      case 'canvas-element-removed':
        this.newObjectAddedToCanvas(action.sceneObj);
        break;
    }

    this.setState({ undoStack, redoStack: [...this.state.redoStack, action] });
  }

  /**
   * Some edit actions also require clearing selection or selecting new objects
   */
  private performAction(action: DashboardEditActionEventPayload) {
    action.perform();

    switch (action.type) {
      case 'canvas-element-added':
        this.newObjectAddedToCanvas(action.sceneObj);
        break;
      case 'canvas-element-removed':
        this.clearSelection();
        break;
    }
  }

  /**
   * Removes last action from redo stack and adds it to undo stack.   *
   */
  public redoAction() {
    const redoStack = this.state.redoStack.slice();
    const action = redoStack.pop();
    if (!action) {
      return;
    }

    this.performAction(action);

    this.setState({ redoStack, undoStack: [...this.state.redoStack, action] });
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

    const elementId = containsCloneKey(element.id) ? getOriginalKey(element.id) : element.id;

    const obj = sceneGraph.findByKey(this, elementId);
    if (obj) {
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
    this.state.selection!.markAsNewElement();
  }
}

import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneObjectState,
  SceneObjectBase,
  SceneObject,
  SceneObjectRef,
  sceneGraph,
  useSceneObjectState,
} from '@grafana/scenes';
import { ElementSelectionContextItem, ElementSelectionContextState, ToolbarButton, useStyles2 } from '@grafana/ui';

import { isBulkEditableDashboardElements, isEditableDashboardElement } from '../scene/types';
import { getDashboardSceneFor } from '../utils/utils';

import { ElementEditPane } from './ElementEditPane';
import { MultiSelectedElementsEditPane } from './MultiSelectedElementsEditPane';
import { useEditableElement } from './useEditableElement';

export interface DashboardEditPaneState extends SceneObjectState {
  selectedObjects?: Array<SceneObjectRef<SceneObject>>;
  selectionContext: ElementSelectionContextState;
}

export class DashboardEditPane extends SceneObjectBase<DashboardEditPaneState> {
  public constructor() {
    super({
      selectionContext: {
        enabled: false,
        selected: [],
        onSelect: (item, multi) => this.selectElement(item, multi),
      },
    });
  }

  public enableSelection() {
    // Enable element selection
    this.setState({ selectionContext: { ...this.state.selectionContext, enabled: true } });
  }

  public disableSelection() {
    this.setState({
      selectionContext: { ...this.state.selectionContext, selected: [], enabled: false },
      selectedObjects: undefined,
    });
  }

  private selectElement(element: ElementSelectionContextItem, multi?: boolean) {
    const obj = sceneGraph.findByKey(this, element.id);
    if (obj) {
      this.selectObject(obj, element.id, multi);
    }
  }

  public selectObject(obj: SceneObject, id: string, multi?: boolean) {
    const currentSelection = this.state.selectedObjects?.[0].resolve();
    console.log(currentSelection, obj, this.state.selectedObjects);
    if (currentSelection === obj && !multi) {
      this.clearSelection();
      return;
    }

    const ref = obj.getRef();
    let selected = [{ id }];
    let selectedObjects = [ref];

    // if we are multi selecting, we need to check if the current selection is of the same type
    if (multi && currentSelection?.constructor.name === obj.constructor.name) {
      selectedObjects = [ref, ...(this.state.selectedObjects ?? [])];
      selected = [{ id }, ...this.state.selectionContext.selected];
    }

    this.setState({
      selectedObjects,
      selectionContext: {
        ...this.state.selectionContext,
        selected,
      },
    });

    selectedObjects.map((el) => console.log(el.resolve()));
  }

  public clearSelection() {
    const dashboard = getDashboardSceneFor(this);
    this.setState({
      selectedObjects: [dashboard.getRef()],
      selectionContext: {
        ...this.state.selectionContext,
        selected: [],
      },
    });
  }
}

export interface Props {
  editPane: DashboardEditPane;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

/**
 * Making the EditPane rendering completely standalone (not using editPane.Component) in order to pass custom react props
 */
export function DashboardEditPaneRenderer({ editPane, isCollapsed, onToggleCollapse }: Props) {
  // Activate the edit pane
  useEffect(() => {
    if (!editPane.state.selectedObjects) {
      const dashboard = getDashboardSceneFor(editPane);
      editPane.setState({ selectedObjects: [dashboard.getRef()] });
    }

    editPane.enableSelection();

    return () => {
      editPane.disableSelection();
    };
  }, [editPane]);

  const { selectedObjects } = useSceneObjectState(editPane, { shouldActivateOrKeepAlive: true });
  const styles = useStyles2(getStyles);
  const paneRef = useRef<HTMLDivElement>(null);
  const editableElement = useEditableElement(selectedObjects);

  if (!editableElement) {
    return null;
  }

  if (isCollapsed) {
    return (
      <div className={styles.expandOptionsWrapper}>
        <ToolbarButton
          tooltip={'Open options pane'}
          icon={'arrow-to-right'}
          onClick={onToggleCollapse}
          variant="canvas"
          className={styles.rotate180}
          aria-label={'Open options pane'}
        />
      </div>
    );
  }

  return (
    <div className={styles.wrapper} ref={paneRef}>
      {isBulkEditableDashboardElements(editableElement) && (
        <MultiSelectedElementsEditPane bulkEditElement={editableElement} />
      )}
      {isEditableDashboardElement(editableElement) && (
        <ElementEditPane element={editableElement} key={editableElement.getTypeName()} />
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      overflow: 'auto',
    }),
    rotate180: css({
      rotate: '180deg',
    }),
    expandOptionsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2, 1),
    }),
  };
}

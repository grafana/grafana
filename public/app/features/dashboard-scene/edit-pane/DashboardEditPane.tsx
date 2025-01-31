import { css, cx } from '@emotion/css';
import { Resizable } from 're-resizable';
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

import { getDashboardSceneFor } from '../utils/utils';

import { ElementEditPane } from './ElementEditPane';
import { useEditableElement } from './useEditableElement';

export interface DashboardEditPaneState extends SceneObjectState {
  selectedObject?: SceneObjectRef<SceneObject>;
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
      selectedObject: undefined,
    });
  }

  private selectElement(element: ElementSelectionContextItem, multi?: boolean) {
    const obj = sceneGraph.findByKey(this, element.id);
    if (obj) {
      this.selectObject(obj, element.id, multi);
    }
  }

  public selectObject(obj: SceneObject, id: string, multi?: boolean) {
    const currentSelection = this.state.selectedObject?.resolve();
    if (currentSelection === obj) {
      this.clearSelection();
      return;
    }

    this.setState({
      selectedObject: obj.getRef(),
      selectionContext: {
        ...this.state.selectionContext,
        selected: [{ id }],
      },
    });
  }

  public clearSelection() {
    const dashboard = getDashboardSceneFor(this);
    this.setState({
      selectedObject: dashboard.getRef(),
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
  openOverlay?: boolean;
  onToggleCollapse: () => void;
}

/**
 * Making the EditPane rendering completely standalone (not using editPane.Component) in order to pass custom react props
 */
export function DashboardEditPaneRenderer({ editPane, isCollapsed, onToggleCollapse, openOverlay }: Props) {
  // Activate the edit pane
  useEffect(() => {
    if (!editPane.state.selectedObject) {
      const dashboard = getDashboardSceneFor(editPane);
      editPane.setState({ selectedObject: dashboard.getRef() });
    }

    editPane.enableSelection();

    return () => {
      editPane.disableSelection();
    };
  }, [editPane]);

  const { selectedObject } = useSceneObjectState(editPane, { shouldActivateOrKeepAlive: true });
  const styles = useStyles2(getStyles);
  const paneRef = useRef<HTMLDivElement>(null);
  const editableElement = useEditableElement(selectedObject?.resolve());

  if (!editableElement) {
    return null;
  }

  if (isCollapsed) {
    return (
      <>
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

        {openOverlay && (
          <Resizable className={cx(styles.fixed, styles.container)} defaultSize={{ height: '100%' }}>
            <ElementEditPane element={editableElement} key={editableElement.getTypeName()} />
          </Resizable>
        )}
      </>
    );
  }

  return (
    <div className={styles.wrapper} ref={paneRef}>
      <ElementEditPane element={editableElement} key={editableElement.getTypeName()} />
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
    // @ts-expect-error csstype doesn't allow !important. see https://github.com/frenic/csstype/issues/114
    fixed: css({
      position: 'absolute !important',
    }),
    container: css({
      right: 0,
      background: theme.colors.background.primary,
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      boxShadow: theme.shadows.z3,
      zIndex: theme.zIndex.navbarFixed,
      overflowX: 'hidden',
      overflowY: 'scroll',
    }),
  };
}

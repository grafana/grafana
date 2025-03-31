import { css, cx } from '@emotion/css';
import { Resizable } from 're-resizable';
import { useEffect } from 'react';
import { useLocalStorage } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObjectState, SceneObjectBase, SceneObject, sceneGraph, useSceneObjectState } from '@grafana/scenes';
import {
  ElementSelectionContextItem,
  ElementSelectionContextState,
  ScrollContainer,
  ToolbarButton,
  useSplitter,
  useStyles2,
  Text,
  Icon,
} from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { isInCloneChain } from '../utils/clone';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardAddPane } from './DashboardAddPane';
import { DashboardOutline } from './DashboardOutline';
import { ElementEditPane } from './ElementEditPane';
import { ElementSelection } from './ElementSelection';
import { NewObjectAddedToCanvasEvent, ObjectRemovedFromCanvasEvent, ObjectsReorderedOnCanvasEvent } from './shared';
import { useEditableElement } from './useEditableElement';

export interface DashboardEditPaneState extends SceneObjectState {
  selection?: ElementSelection;
  selectionContext: ElementSelectionContextState;
  showAddPane?: boolean;
}

export type EditPaneTab = 'add' | 'configure' | 'outline';

export class DashboardEditPane extends SceneObjectBase<DashboardEditPaneState> {
  public constructor() {
    super({
      selectionContext: {
        enabled: false,
        selected: [],
        onSelect: (item, multi) => this.selectElement(item, multi),
        onClear: () => this.clearSelection(),
      },
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const dashboard = getDashboardSceneFor(this);

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

  private selectElement(element: ElementSelectionContextItem, multi?: boolean) {
    // We should not select clones
    if (isInCloneChain(element.id)) {
      if (multi) {
        return;
      }

      this.clearSelection();
      return;
    }

    const obj = sceneGraph.findByKey(this, element.id);
    if (obj) {
      this.selectObject(obj, element.id, multi);
    }
  }

  public getSelection(): SceneObject | SceneObject[] | undefined {
    return this.state.selection?.getSelection();
  }

  public toggleAddPane() {
    this.setState({ showAddPane: !this.state.showAddPane });
  }

  public selectObject(obj: SceneObject, id: string, multi?: boolean) {
    const prevItem = this.state.selection?.getFirstObject();
    if (prevItem === obj && !multi) {
      this.clearSelection();
      return;
    }

    if (multi && this.state.selection?.hasValue(id)) {
      this.removeMultiSelectedObject(id);
      return;
    }

    const elementSelection = this.state.selection ?? new ElementSelection([[id, obj.getRef()]]);

    const { selection, contextItems: selected } = elementSelection.getStateWithValue(id, obj, !!multi);

    this.setState({
      selection: new ElementSelection(selection),
      selectionContext: {
        ...this.state.selectionContext,
        selected,
      },
      showAddPane: false,
    });
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

    this.setState({
      selection: new ElementSelection([...entries]),
      selectionContext: {
        ...this.state.selectionContext,
        selected,
      },
    });
  }

  public clearSelection() {
    if (!this.state.selection) {
      return;
    }

    this.setState({
      selection: undefined,
      selectionContext: {
        ...this.state.selectionContext,
        selected: [],
      },
    });
  }

  private newObjectAddedToCanvas(obj: SceneObject) {
    this.selectObject(obj, obj.state.key!, false);

    if (this.state.showAddPane) {
      this.setState({ showAddPane: false });
    }
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
    editPane.enableSelection();

    return () => {
      editPane.disableSelection();
    };
  }, [editPane]);

  useEffect(() => {
    if (isCollapsed) {
      editPane.clearSelection();
    }
  }, [editPane, isCollapsed]);

  const { selection, showAddPane } = useSceneObjectState(editPane, { shouldActivateOrKeepAlive: true });
  const styles = useStyles2(getStyles);
  const editableElement = useEditableElement(selection, editPane);
  const selectedObject = selection?.getFirstObject();
  const [outlineCollapsed, setOutlineCollapsed] = useLocalStorage(
    'grafana.dashboard.edit-pane.outline.collapsed',
    true
  );
  const [outlinePaneSize = 0.4, setOutlinePaneSize] = useLocalStorage('grafana.dashboard.edit-pane.outline.size', 0.4);

  // splitter for template and payload editor
  const splitter = useSplitter({
    direction: 'column',
    handleSize: 'sm',
    // if Grafana Alertmanager, split 50/50, otherwise 100/0 because there is no payload editor
    initialSize: 1 - outlinePaneSize,
    dragPosition: 'middle',
    onSizeChanged: (size) => {
      setOutlinePaneSize(1 - size);
    },
  });

  if (!editableElement) {
    return null;
  }

  if (isCollapsed) {
    return (
      <>
        <div className={styles.expandOptionsWrapper}>
          <ToolbarButton
            tooltip={t('dashboard.edit-pane.open', 'Open options pane')}
            icon="arrow-to-right"
            onClick={onToggleCollapse}
            variant="canvas"
            narrow={true}
            className={styles.rotate180}
            aria-label={t('dashboard.edit-pane.open', 'Open options pane')}
          />
        </div>

        {openOverlay && (
          <Resizable className={styles.overlayWrapper} defaultSize={{ height: '100%', width: '300px' }}>
            <ElementEditPane element={editableElement} key={selectedObject?.state.key} editPane={editPane} />
          </Resizable>
        )}
      </>
    );
  }

  if (outlineCollapsed) {
    splitter.primaryProps.style.flexGrow = 1;
    splitter.primaryProps.style.minHeight = 'unset';
    splitter.secondaryProps.style.flexGrow = 0;
    splitter.secondaryProps.style.minHeight = 'min-content';
  } else {
    splitter.primaryProps.style.minHeight = 'unset';
    splitter.secondaryProps.style.minHeight = 'unset';
  }

  if (showAddPane) {
    return (
      <div className={styles.wrapper}>
        <DashboardAddPane editPane={editPane} />
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div {...splitter.containerProps}>
        <div {...splitter.primaryProps} className={cx(splitter.primaryProps.className, styles.paneContent)}>
          <ElementEditPane element={editableElement} key={selectedObject?.state.key} editPane={editPane} />
        </div>
        <div
          {...splitter.splitterProps}
          className={cx(splitter.splitterProps.className, styles.splitter)}
          data-edit-pane-splitter={true}
        />
        <div {...splitter.secondaryProps} className={cx(splitter.primaryProps.className, styles.paneContent)}>
          <div
            role="button"
            onClick={() => setOutlineCollapsed(!outlineCollapsed)}
            className={styles.outlineCollapseButton}
          >
            <Text weight="medium">Outline</Text>
            <Icon name="angle-up" />
          </div>
          {!outlineCollapsed && (
            <div className={styles.outlineContainer}>
              <ScrollContainer showScrollIndicators={true}>
                <DashboardOutline editPane={editPane} />
              </ScrollContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      marginTop: theme.spacing(2),
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
    }),
    overlayWrapper: css({
      right: 0,
      bottom: 0,
      top: theme.spacing(2),
      position: 'absolute !important' as 'absolute',
      background: theme.colors.background.primary,
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      boxShadow: theme.shadows.z3,
      zIndex: theme.zIndex.navbarFixed,
      flexGrow: 1,
    }),
    paneContent: css({
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }),
    rotate180: css({
      rotate: '180deg',
    }),
    tabsbar: css({
      padding: theme.spacing(0, 1),
      margin: theme.spacing(0.5, 0),
    }),
    expandOptionsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2, 1, 2, 0),
    }),
    splitter: css({
      '&:after': {
        display: 'none',
      },
    }),
    outlineCollapseButton: css({
      display: 'flex',
      padding: theme.spacing(0.5, 2),
      gap: theme.spacing(1),
      justifyContent: 'space-between',
      alignItems: 'center',
      background: theme.colors.background.secondary,

      '&:hover': {
        background: theme.colors.action.hover,
      },
    }),
    outlineContainer: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      overflow: 'hidden',
    }),
  };
}

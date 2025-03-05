import { css, cx } from '@emotion/css';
import { Resizable } from 're-resizable';
import { useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObjectState, SceneObjectBase, SceneObject, sceneGraph, useSceneObjectState } from '@grafana/scenes';
import {
  ElementSelectionContextItem,
  ElementSelectionContextState,
  Tab,
  TabsBar,
  ToolbarButton,
  useStyles2,
} from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { isInCloneChain } from '../utils/clone';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardAddPane } from './DashboardAddPane';
import { DashboardOutline } from './DashboardOutline';
import { ElementEditPane } from './ElementEditPane';
import { ElementSelection } from './ElementSelection';
import { useEditableElement } from './useEditableElement';

export interface DashboardEditPaneState extends SceneObjectState {
  selection?: ElementSelection;
  selectionContext: ElementSelectionContextState;
  tab?: EditPaneTab;
}

export type EditPaneTab = 'add' | 'configure' | 'outline';

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

  public selectObject(obj: SceneObject, id: string, multi?: boolean) {
    if (!this.state.selection) {
      return;
    }

    const prevItem = this.state.selection.getFirstObject();
    if (prevItem === obj && !multi) {
      this.clearSelection();
      return;
    }

    if (multi && this.state.selection.hasValue(id)) {
      this.removeMultiSelectedObject(id);
      return;
    }

    const { selection, contextItems: selected } = this.state.selection.getStateWithValue(id, obj, !!multi);

    this.setState({
      selection: new ElementSelection(selection),
      selectionContext: {
        ...this.state.selectionContext,
        selected,
      },
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
    const dashboard = getDashboardSceneFor(this);

    if (this.state.selection?.getFirstObject() === dashboard) {
      return;
    }

    this.setState({
      selection: new ElementSelection([[dashboard.state.uid!, dashboard.getRef()]]),
      selectionContext: {
        ...this.state.selectionContext,
        selected: [],
      },
    });
  }

  public onChangeTab = (tab: EditPaneTab) => {
    this.setState({ tab });
  };
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
    if (!editPane.state.selection) {
      const dashboard = getDashboardSceneFor(editPane);
      editPane.setState({
        selection: new ElementSelection([[dashboard.state.uid!, dashboard.getRef()]]),
      });
    }

    editPane.enableSelection();

    return () => {
      editPane.disableSelection();
    };
  }, [editPane]);

  useEffect(() => {
    if (isCollapsed && editPane.state.selection?.getSelectionEntries().length) {
      editPane.clearSelection();
    }
  }, [editPane, isCollapsed]);

  const { selection, tab = 'configure' } = useSceneObjectState(editPane, { shouldActivateOrKeepAlive: true });
  const styles = useStyles2(getStyles);
  const paneRef = useRef<HTMLDivElement>(null);
  const editableElement = useEditableElement(selection);

  if (!editableElement) {
    return null;
  }

  const { typeId } = editableElement.getEditableElementInfo();

  if (isCollapsed) {
    return (
      <>
        <div className={styles.expandOptionsWrapper}>
          <ToolbarButton
            tooltip={t('dashboard.edit-pane.open', 'Open options pane')}
            icon="arrow-to-right"
            onClick={onToggleCollapse}
            variant="canvas"
            className={styles.rotate180}
            aria-label={t('dashboard.edit-pane.open', 'Open options pane')}
          />
        </div>

        {openOverlay && (
          <Resizable className={cx(styles.fixed, styles.container)} defaultSize={{ height: '100%', width: '20vw' }}>
            <ElementEditPane element={editableElement} key={typeId} />
          </Resizable>
        )}
      </>
    );
  }

  return (
    <div className={styles.wrapper} ref={paneRef}>
      <TabsBar className={styles.tabsbar}>
        <Tab
          active={tab === 'add'}
          label={t('dashboard.editpane.add', 'Add')}
          onChangeTab={() => editPane.onChangeTab('add')}
        />
        <Tab
          active={tab === 'configure'}
          label={t('dashboard.editpane.configure', 'Configure')}
          onChangeTab={() => editPane.onChangeTab('configure')}
        />
        <Tab
          active={tab === 'outline'}
          label={t('dashboard.editpane.outline', 'Outline')}
          onChangeTab={() => editPane.onChangeTab('outline')}
        />
      </TabsBar>
      <div className={styles.tabContent}>
        {tab === 'add' && <DashboardAddPane editPane={editPane} />}
        {tab === 'configure' && <ElementEditPane element={editableElement} key={typeId} />}
        {tab === 'outline' && <DashboardOutline editPane={editPane} />}
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
    }),
    tabContent: css({
      display: 'flex',
      flex: '1 1 0',
      flexDirection: 'column',
      minHeight: 0,
      overflow: 'auto',
    }),
    rotate180: css({
      rotate: '180deg',
    }),
    tabsbar: css({
      padding: theme.spacing(0, 1),
      margin: theme.spacing(0.5, 1),
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

import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useSceneObjectState } from '@grafana/scenes';
import { Sidebar } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';
import { ToolbarActionProps } from '../scene/new-toolbar/types';

import { DashboardEditPane } from './DashboardEditPane';
import { DashboardOutline } from './DashboardOutline';
import { ElementEditPane } from './ElementEditPane';

export interface Props {
  editPane: DashboardEditPane;
  dashboard: DashboardScene;
  isDocked?: boolean;
}

/**
 * Making the EditPane rendering completely standalone (not using editPane.Component) in order to pass custom react props
 */
export function DashboardEditPaneRenderer({ editPane, dashboard, isDocked }: Props) {
  const { selection, openPane } = useSceneObjectState(editPane, { shouldActivateOrKeepAlive: true });
  const { isEditing } = dashboard.useState();
  const selectedObject = selection?.getFirstObject();
  const isNewElement = selection?.isNewElement() ?? false;

  const editableElement = useMemo(() => {
    if (selection) {
      return selection.createSelectionElement();
    }

    return undefined;
  }, [selection]);

  // const [outlineCollapsed, setOutlineCollapsed] = useLocalStorage(
  //   'grafana.dashboard.edit-pane.outline.collapsed',
  //   true
  // );
  // const [outlinePaneSize = 0.4, setOutlinePaneSize] = useLocalStorage('grafana.dashboard.edit-pane.outline.size', 0.4);

  // splitter for template and payload editor
  // const splitter = useSplitter({
  //   direction: 'column',
  //   handleSize: 'sm',
  //   // if Grafana Alertmanager, split 50/50, otherwise 100/0 because there is no payload editor
  //   initialSize: 1 - outlinePaneSize,
  //   dragPosition: 'middle',
  //   onSizeChanged: (size) => {
  //     setOutlinePaneSize(1 - size);
  //   },
  // });

  // if (outlineCollapsed) {
  //   splitter.primaryProps.style.flexGrow = 1;
  //   splitter.primaryProps.style.minHeight = 'unset';
  //   splitter.secondaryProps.style.flexGrow = 0;
  //   splitter.secondaryProps.style.minHeight = 'min-content';
  // } else {
  //   splitter.primaryProps.style.minHeight = 'unset';
  //   splitter.secondaryProps.style.minHeight = 'unset';
  // }

  return (
    <>
      {editableElement && (
        <Sidebar.OpenPane>
          <ElementEditPane
            key={selectedObject?.state.key}
            editPane={editPane}
            element={editableElement}
            isNewElement={isNewElement}
          />
        </Sidebar.OpenPane>
      )}
      {openPane === 'outline' && (
        <Sidebar.OpenPane>
          <DashboardOutline editPane={editPane} isEditing={isEditing} />
        </Sidebar.OpenPane>
      )}
      <Sidebar.Toolbar>
        {isEditing && (
          <>
            {config.featureToggles.dashboardUndoRedo && (
              <>
                <UndoButton dashboard={dashboard} />
                <RedoButton dashboard={dashboard} />
              </>
            )}
            <Sidebar.Button
              icon="cog"
              onClick={() => editPane.selectObject(dashboard, dashboard.state.key!)}
              title={t('dashboard.sidebar.dashboard-options', 'Options')}
              tooltip={t('dashboard.sidebar.dashboard-options-tooltip', 'Dashboard options')}
              active={selectedObject === dashboard ? true : false}
            />
            <Sidebar.Divider />
          </>
        )}

        <Sidebar.Button icon="download-alt" title={t('dashboard.sidebar.export', 'Export')} />
        <Sidebar.Button
          icon="list-ui-alt"
          onClick={() => editPane.openPane('outline')}
          title={t('dashboard.sidebar.outline', 'Outline')}
          tooltip={t('dashboard.sidebar.outline-tooltip', 'Content outline')}
          active={openPane === 'outline'}
        ></Sidebar.Button>
      </Sidebar.Toolbar>
    </>
  );
}

function UndoButton({ dashboard }: ToolbarActionProps) {
  const editPane = dashboard.state.editPane;
  const { undoStack } = editPane.useState();
  const undoAction = undoStack[undoStack.length - 1];
  const undoWord = t('dashboard.sidebar.undo', 'Undo');
  const tooltip = `${undoWord}${undoAction?.description ? ` ${undoAction.description}` : ''}`;

  return (
    <Sidebar.Button
      icon="corner-up-left"
      disabled={undoStack.length === 0}
      onClick={() => editPane.undoAction()}
      title={undoWord}
      tooltip={tooltip}
    />
  );
}

function RedoButton({ dashboard }: ToolbarActionProps) {
  const editPane = dashboard.state.editPane;
  const { redoStack } = editPane.useState();
  const redoAction = redoStack[redoStack.length - 1];
  const redoWord = t('dashboard.sidebar.redo', 'Redo');
  const tooltip = `${redoWord}${redoAction?.description ? ` ${redoAction.description}` : ''}`;

  return (
    <Sidebar.Button
      icon="corner-up-right"
      disabled={redoStack.length === 0}
      title={redoWord}
      tooltip={tooltip}
      onClick={() => editPane.redoAction()}
    />
  );
}

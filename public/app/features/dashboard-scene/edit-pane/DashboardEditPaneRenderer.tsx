import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useSceneObjectState } from '@grafana/scenes';
import { Sidebar } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';
import { ToolbarActionProps } from '../scene/new-toolbar/types';

import { DashboardEditPane } from './DashboardEditPane';
import { ShareExportDashboardButton } from './DashboardExportButton';
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
              title={t('dashboard.sidebar.dashboard-options.title', 'Options')}
              tooltip={t('dashboard.sidebar.dashboard-options.tooltip', 'Dashboard options')}
              active={selectedObject === dashboard ? true : false}
            />
            <Sidebar.Button
              tooltip={t('dashboard.sidebar.edit-schema.tooltip', 'Edit as code')}
              title={t('dashboard.sidebar.edit-schema.title', 'Code')}
              icon="brackets-curly"
              onClick={() => dashboard.openV2SchemaEditor()}
            />
            <Sidebar.Divider />
          </>
        )}
        <ShareExportDashboardButton dashboard={dashboard} />
        <Sidebar.Button
          icon="list-ui-alt"
          onClick={() => editPane.openPane('outline')}
          title={t('dashboard.sidebar.outline.title', 'Outline')}
          tooltip={t('dashboard.sidebar.outline.tooltip', 'Content outline')}
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

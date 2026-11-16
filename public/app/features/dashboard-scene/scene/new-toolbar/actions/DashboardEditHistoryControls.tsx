import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { useFlagDashboardUndoRedo } from '@grafana/runtime/internal';
import { ButtonGroup, ToolbarButton } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { isDashboardNewLayoutsEnabled } from 'app/features/dashboard/api/utils';
import { KioskMode } from 'app/types/dashboard';

import { usePendingChangesHistoryState } from '../../../lifecycle/pendingChangesHistory';
import { isFullDashboardEditing } from '../../types/dashboard';
import { type ToolbarActionProps } from '../types';

export function DashboardEditHistoryControls({ dashboard }: ToolbarActionProps) {
  const dashboardState = dashboard.useState();
  const { chrome } = useGrafana();
  const { kioskMode } = chrome.useState();
  const dashboardUndoRedo = useFlagDashboardUndoRedo();

  // The edit history is driven by the edit sidebar, which only exists with new layouts, is not part of
  // panel edit, and is not rendered on a full kiosk display.
  const isVisible =
    dashboardUndoRedo &&
    isDashboardNewLayoutsEnabled() &&
    isFullDashboardEditing(dashboardState) &&
    !dashboardState.editPanel &&
    kioskMode !== KioskMode.Full;

  if (!isVisible) {
    return null;
  }

  return (
    // The controls row clears the sidebar selection on pointerdown, which would lose the element being edited.
    <ButtonGroup onPointerDown={(event) => event.stopPropagation()}>
      <UndoButton dashboard={dashboard} />
      <RedoButton dashboard={dashboard} />
    </ButtonGroup>
  );
}

function UndoButton({ dashboard }: ToolbarActionProps) {
  const sidebar = dashboard.state.sidebar;
  const { undoStack } = sidebar.useState();
  const history = sidebar.pendingChangesHistory();
  const historyState = usePendingChangesHistoryState(history);
  const label = t('dashboard.toolbar.undo', 'Undo');
  const description = history ? historyState.undo : undoStack[undoStack.length - 1]?.description;

  return (
    <ToolbarButton
      variant="canvas"
      icon="corner-up-left"
      aria-label={label}
      tooltip={description ? t('dashboard.toolbar.undo-action', 'Undo: {{action}}', { action: description }) : label}
      disabled={history ? !historyState.undo : undoStack.length === 0}
      onClick={() => sidebar.undoAction()}
      data-testid={selectors.pages.Dashboard.EditHistory.undo}
    />
  );
}

function RedoButton({ dashboard }: ToolbarActionProps) {
  const sidebar = dashboard.state.sidebar;
  const { redoStack } = sidebar.useState();
  const history = sidebar.pendingChangesHistory();
  const historyState = usePendingChangesHistoryState(history);
  const label = t('dashboard.toolbar.redo', 'Redo');
  const description = history ? historyState.redo : redoStack[redoStack.length - 1]?.description;

  return (
    <ToolbarButton
      variant="canvas"
      icon="corner-up-right"
      aria-label={label}
      tooltip={description ? t('dashboard.toolbar.redo-action', 'Redo: {{action}}', { action: description }) : label}
      disabled={history ? !historyState.redo : redoStack.length === 0}
      onClick={() => sidebar.redoAction()}
      data-testid={selectors.pages.Dashboard.EditHistory.redo}
    />
  );
}

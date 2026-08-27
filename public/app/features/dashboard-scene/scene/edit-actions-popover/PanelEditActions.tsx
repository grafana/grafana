import { cx } from '@emotion/css';
import { useCallback, useMemo, type JSX } from 'react';

import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { type VizPanel } from '@grafana/scenes';
import { Button, useStyles2, useTheme2 } from '@grafana/ui';

import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { getLayoutManagerFor } from '../../utils/getLayoutManagerFor';
import { DashboardInteractions } from '../../utils/interactions';
import { getPanelIdForVizPanel } from '../../utils/utils';
import { getDashboardSceneLike } from '../types/dashboard';

import {
  CopyActionButton,
  DeleteActionButton,
  DuplicateActionButton,
  getActionStyles,
  SettingsActionButton,
} from './EditActions';
import { useEditActionsLayout } from './EditActionsLayoutContext';
import { EditActionsPopover, useHoverPopoverSupported } from './EditActionsPopover';

export function PanelEditActions({
  onClickEdit,
  onClickEditVisualization,
  onClickCopy,
  onClickDuplicate,
  onClickDelete,
  isRepeated,
}: {
  onClickEdit: () => void;
  onClickEditVisualization: () => void;
  onClickCopy: () => void;
  onClickDuplicate: () => void;
  onClickDelete: () => void;
  isRepeated: boolean;
}) {
  const styles = useStyles2(getActionStyles);

  return (
    <>
      <SettingsActionButton onClick={onClickEdit} />
      <div className={styles.actionsDivider} />
      <Button
        fill="text"
        variant="secondary"
        size="sm"
        className={cx(styles.action, styles.textAction)}
        onClick={onClickEditVisualization}
      >
        {t('dashboard-scene.panel-edit-actions.edit-visualization', 'Edit visualization')}
      </Button>
      <div className={styles.actionsDivider} />
      <CopyActionButton onClick={onClickCopy} isRepeated={isRepeated} />
      <DuplicateActionButton onClick={onClickDuplicate} isRepeated={isRepeated} />
      <DeleteActionButton
        title={t('dashboard.sidebar.viz-panel.delete-panel-title', 'Delete panel?')}
        text={t(
          'dashboard.sidebar.viz-panel.delete-panel-text',
          'Deleting this panel will also remove all queries. Are you sure you want to continue?'
        )}
        yesText={t('dashboard.sidebar.viz-panel.delete-panel-yes', 'Delete')}
        onConfirm={onClickDelete}
        isRepeated={isRepeated}
      />
    </>
  );
}

export function PanelEditActionsWrapper({ panel, children }: { panel: VizPanel; children: JSX.Element }) {
  const theme = useTheme2();
  const isPopoverSupported = useHoverPopoverSupported();
  const { getPortalRoot, getSidebarShiftPadding } = useEditActionsLayout();

  const onClickEdit = useCallback(() => {
    const { selectionContext } = getDashboardSceneLike(panel).state.sidebar.state;
    selectionContext.onSelect({ id: panel.state.key! }, { force: true });
  }, [panel]);

  const onClickEditVisualization = useCallback(() => {
    const panelId = getPanelIdForVizPanel(panel);
    DashboardInteractions.panelActionClicked('configure', panelId, 'edit_popover');
    locationService.partial({ editPanel: panelId });
  }, [panel]);

  const onClickCopy = useCallback(() => {
    const panelId = getPanelIdForVizPanel(panel);
    DashboardInteractions.panelActionClicked('copy', panelId, 'edit_popover');
    getDashboardSceneLike(panel).copyPanel(panel);
  }, [panel]);

  const onClickDuplicate = useCallback(() => {
    const panelId = getPanelIdForVizPanel(panel);
    DashboardInteractions.panelActionClicked('duplicate', panelId, 'edit_popover');
    getLayoutManagerFor(panel).duplicatePanel?.(panel);
  }, [panel]);

  const onClickDelete = useCallback(() => {
    const panelId = getPanelIdForVizPanel(panel);
    DashboardInteractions.panelActionClicked('delete', panelId, 'edit_popover');
    getLayoutManagerFor(panel).removePanel?.(panel);
  }, [panel]);

  const editActions = useMemo(
    () => (
      <PanelEditActions
        onClickEdit={onClickEdit}
        onClickEditVisualization={onClickEditVisualization}
        onClickCopy={onClickCopy}
        onClickDuplicate={onClickDuplicate}
        onClickDelete={onClickDelete}
        isRepeated={isRepeatCloneOrChildOf(panel)}
      />
    ),
    [onClickEdit, onClickEditVisualization, onClickCopy, onClickDuplicate, onClickDelete, panel]
  );

  return (
    <EditActionsPopover
      content={editActions}
      disabled={!isPopoverSupported}
      placement="top-end"
      portalRoot={getPortalRoot}
      zIndex={theme.zIndex.dropdown}
      shiftPadding={getSidebarShiftPadding}
    >
      {children}
    </EditActionsPopover>
  );
}

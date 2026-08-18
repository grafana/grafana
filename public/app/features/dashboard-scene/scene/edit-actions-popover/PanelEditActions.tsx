import { cx } from '@emotion/css';
import { useCallback, useMemo, type JSX } from 'react';

import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { type VizPanel } from '@grafana/scenes';
import { Button, useElementSelection, useStyles2 } from '@grafana/ui';

import { VizPanelEditableElement } from '../../sidebar/VizPanelEditableElement';
import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { DashboardInteractions } from '../../utils/interactions';
import { getDashboardSceneFor, getPanelIdForVizPanel } from '../../utils/utils';

import {
  CopyActionButton,
  DeleteActionButton,
  DuplicateActionButton,
  getActionStyles,
  SettingsActionButton,
} from './EditActions';
import { EditActionsPopover } from './EditActionsPopover';

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

export function PanelEditWrapper({ panel, children }: { panel: VizPanel; children: JSX.Element }) {
  const { isSelectable } = useElementSelection(panel.state.key);

  const onClickEdit = useCallback(() => {
    const dashboard = getDashboardSceneFor(panel);
    // Use onSelect (not selectObject) so repeated clones remap to the source panel
    dashboard.state.sidebar.state.selectionContext.onSelect({ id: panel.state.key! }, { force: true });
  }, [panel]);

  const onClickEditVisualization = useCallback(() => {
    const panelId = getPanelIdForVizPanel(panel);
    locationService.partial({ editPanel: panelId });
    DashboardInteractions.panelActionClicked('configure', panelId, 'edit_popover');
  }, [panel]);

  const onClickCopy = useCallback(() => {
    new VizPanelEditableElement(panel).onCopy('edit_popover');
  }, [panel]);

  const onClickDuplicate = useCallback(() => {
    new VizPanelEditableElement(panel).onDuplicate('edit_popover');
  }, [panel]);

  const onClickDelete = useCallback(() => {
    new VizPanelEditableElement(panel).onDelete('edit_popover');
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
    <EditActionsPopover isEditable={Boolean(isSelectable)} content={editActions} placement="top-end">
      {children}
    </EditActionsPopover>
  );
}

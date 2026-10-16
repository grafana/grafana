import { cx } from '@emotion/css';
import { useMemo, type JSX } from 'react';

import { t } from '@grafana/i18n';
import { useFlagGrafanaPanelHoverActions } from '@grafana/runtime/internal';
import { type VizPanel } from '@grafana/scenes';
import { Button, useStyles2, useTheme2 } from '@grafana/ui';

import { isRepeatCloneOrChildOf } from '../../utils/clone';

import {
  CopyActionButton,
  DeleteActionButton,
  DuplicateActionButton,
  getActionStyles,
  SettingsActionButton,
} from './EditActions';
import { useEditActionsLayout } from './EditActionsLayoutContext';
import { EditActionsPopover, useHoverPopoverSupported } from './EditActionsPopover';
import { PanelHoverActionsWrapper } from './PanelHoverActions';
import { usePanelEditActionHandlers } from './usePanelEditActionHandlers';

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
  const hoverActions = useFlagGrafanaPanelHoverActions();

  if (hoverActions) {
    return <PanelHoverActionsWrapper panel={panel}>{children}</PanelHoverActionsWrapper>;
  }

  return <PanelEditActionsPopover panel={panel}>{children}</PanelEditActionsPopover>;
}

function PanelEditActionsPopover({ panel, children }: { panel: VizPanel; children: JSX.Element }) {
  const theme = useTheme2();
  const isPopoverSupported = useHoverPopoverSupported();
  const { getPortalRoot, getSidebarShiftPadding } = useEditActionsLayout();
  const { onClickEdit, onClickEditVisualization, onClickCopy, onClickDuplicate, onClickDelete } =
    usePanelEditActionHandlers(panel, 'edit_popover');

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

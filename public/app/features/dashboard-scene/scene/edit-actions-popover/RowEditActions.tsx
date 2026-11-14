import { type JSX, useCallback } from 'react';

import { t } from '@grafana/i18n';
import { useFlagGrafanaDashboardSidebarExplicitOpen } from '@grafana/runtime/internal';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { getRepeatSourceObject, isRepeatCloneOrChildOf } from '../../utils/clone';
import { DashboardInteractions } from '../../utils/interactions';
import { type RowItem } from '../layout-rows/RowItem';
import { getDashboardSceneLike } from '../types/dashboard';

import {
  CopyActionButton,
  DeleteActionButton,
  DuplicateActionButton,
  getActionStyles,
  SettingsActionButton,
} from './EditActions';
import { useEditActionsLayout } from './EditActionsLayoutContext';
import { EditActionsPopover } from './EditActionsPopover';

function RowEditActions({ row }: { row: RowItem }) {
  const styles = useStyles2(getActionStyles);
  const isRepeated = isRepeatCloneOrChildOf(row);
  const onClickEdit = useCallback(() => {
    DashboardInteractions.trackDashboardSectionAction('settings', 'row', 'edit_popover');
    getDashboardSceneLike(row).state.sidebar.openElementSettings(getRepeatSourceObject(row));
  }, [row]);

  return (
    <>
      <SettingsActionButton
        onClick={onClickEdit}
        tooltip={t('dashboard-scene.row-edit-actions.tooltip-row-settings', 'Row settings')}
      />
      <div className={styles.actionsDivider} />
      <CopyActionButton
        onClick={() => {
          DashboardInteractions.trackDashboardSectionAction('copy', 'row', 'edit_popover');
          row.onCopy();
        }}
        disabled={isRepeated}
        disabledTooltip={t(
          'dashboard-scene.row-edit-actions.copy-disabled',
          "Repeated rows can't be copied individually"
        )}
      />
      <DuplicateActionButton
        onClick={() => {
          DashboardInteractions.trackDashboardSectionAction('duplicate', 'row', 'edit_popover');
          row.onDuplicate();
        }}
        disabled={isRepeated}
        disabledTooltip={t(
          'dashboard-scene.row-edit-actions.duplicate-disabled',
          "Repeated rows can't be duplicated individually"
        )}
      />
      <DeleteActionButton
        title={t('dashboard.rows-layout.delete-row-title', 'Delete row?')}
        text={t(
          'dashboard.rows-layout.delete-row-text',
          'Deleting this row will also remove all panels. Are you sure you want to continue?'
        )}
        yesText={t('dashboard.rows-layout.delete-row-yes', 'Delete')}
        confirm={row.getLayout().getVizPanels().length > 0}
        onConfirm={() => {
          row.onDelete();
          DashboardInteractions.trackDeleteDashboardElement('row', 'edit_popover');
        }}
        disabled={isRepeated}
        disabledTooltip={t(
          'dashboard-scene.row-edit-actions.delete-disabled',
          "Repeated rows can't be deleted individually"
        )}
      />
    </>
  );
}

export function RowEditActionsWrapper({
  row,
  disabled,
  children,
}: {
  row: RowItem;
  disabled?: boolean;
  children: JSX.Element;
}) {
  const theme = useTheme2();
  const sidebarExplicitOpen = useFlagGrafanaDashboardSidebarExplicitOpen();
  const { getPortalRoot, getSidebarShiftPadding } = useEditActionsLayout();

  return (
    <EditActionsPopover
      keyboardAccessible
      content={<RowEditActions row={row} />}
      disabled={!sidebarExplicitOpen || disabled}
      portalRoot={getPortalRoot}
      zIndex={theme.zIndex.dropdown}
      shiftPadding={getSidebarShiftPadding}
    >
      {children}
    </EditActionsPopover>
  );
}

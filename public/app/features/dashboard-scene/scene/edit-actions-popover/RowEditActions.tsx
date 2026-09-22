import { type JSX, useCallback } from 'react';

import { t } from '@grafana/i18n';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { isRepeatCloneOrChildOf } from '../../utils/clone';
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
import { EditActionsPopover, useHoverPopoverSupported } from './EditActionsPopover';

export function RowEditActions({ row }: { row: RowItem }) {
  const styles = useStyles2(getActionStyles);
  const isRepeated = isRepeatCloneOrChildOf(row);
  const onClickEdit = useCallback(() => {
    const { selectionContext } = getDashboardSceneLike(row).state.sidebar.state;
    selectionContext.onSelect({ id: row.state.key! }, { force: true });
  }, [row]);

  return (
    <>
      <SettingsActionButton onClick={onClickEdit} />
      <div className={styles.actionsDivider} />
      <CopyActionButton
        onClick={() => row.onCopy()}
        disabledReason={
          isRepeated
            ? t('dashboard-scene.row-edit-actions.copy-disabled', "Repeated rows can't be copied individually")
            : undefined
        }
      />
      <DuplicateActionButton
        onClick={() => row.onDuplicate()}
        disabledReason={
          isRepeated
            ? t('dashboard-scene.row-edit-actions.duplicate-disabled', "Repeated rows can't be duplicated individually")
            : undefined
        }
      />
      <DeleteActionButton
        title={t('dashboard.rows-layout.delete-row-title', 'Delete row?')}
        text={t(
          'dashboard.rows-layout.delete-row-text',
          'Deleting this row will also remove all panels. Are you sure you want to continue?'
        )}
        yesText={t('dashboard.rows-layout.delete-row-yes', 'Delete')}
        confirm={row.getLayout().getVizPanels().length > 0}
        onConfirm={() => row.onDelete()}
        disabledReason={
          isRepeated
            ? t('dashboard-scene.row-edit-actions.delete-disabled', "Repeated rows can't be deleted individually")
            : undefined
        }
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
  const isPopoverSupported = useHoverPopoverSupported();
  const { getPortalRoot, getSidebarShiftPadding } = useEditActionsLayout();

  return (
    <EditActionsPopover
      content={<RowEditActions row={row} />}
      disabled={disabled || !isPopoverSupported}
      placement="top-end"
      portalRoot={getPortalRoot}
      zIndex={theme.zIndex.dropdown}
      shiftPadding={getSidebarShiftPadding}
    >
      {children}
    </EditActionsPopover>
  );
}

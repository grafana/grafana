import { type JSX, useCallback } from 'react';

import { t } from '@grafana/i18n';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { type TabItem } from '../layout-tabs/TabItem';
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

export function TabEditActions({ tab }: { tab: TabItem }) {
  const styles = useStyles2(getActionStyles);
  const isRepeated = isRepeatCloneOrChildOf(tab);
  const onClickEdit = useCallback(() => {
    getDashboardSceneLike(tab).state.sidebar.openElementSettings(tab);
  }, [tab]);

  return (
    <>
      <SettingsActionButton onClick={onClickEdit} />
      <div className={styles.actionsDivider} />
      <CopyActionButton
        onClick={() => tab.onCopy()}
        disabledReason={
          isRepeated
            ? t('dashboard-scene.tab-edit-actions.copy-disabled', "Repeated tabs can't be copied individually")
            : undefined
        }
      />
      <DuplicateActionButton
        onClick={() => tab.onDuplicate()}
        disabledReason={
          isRepeated
            ? t('dashboard-scene.tab-edit-actions.duplicate-disabled', "Repeated tabs can't be duplicated individually")
            : undefined
        }
      />
      <DeleteActionButton
        title={t('dashboard.tabs-layout.delete-tab-title', 'Delete tab?')}
        text={t(
          'dashboard.tabs-layout.delete-tab-text',
          'Deleting this tab will also remove all panels. Are you sure you want to continue?'
        )}
        yesText={t('dashboard.tabs-layout.delete-tab-yes', 'Delete')}
        confirm={tab.getLayout().getVizPanels().length > 0}
        onConfirm={() => tab.onDelete()}
        disabledReason={
          isRepeated
            ? t('dashboard-scene.tab-edit-actions.delete-disabled', "Repeated tabs can't be deleted individually")
            : undefined
        }
      />
    </>
  );
}

export function TabEditActionsWrapper({
  tab,
  disabled,
  children,
}: {
  tab: TabItem;
  disabled?: boolean;
  children: JSX.Element;
}) {
  const theme = useTheme2();
  const isPopoverSupported = useHoverPopoverSupported();
  const { getPortalRoot, getSidebarShiftPadding } = useEditActionsLayout();

  return (
    <EditActionsPopover
      content={<TabEditActions tab={tab} />}
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

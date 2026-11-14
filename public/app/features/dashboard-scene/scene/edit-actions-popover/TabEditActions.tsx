import { type JSX, useCallback } from 'react';

import { t } from '@grafana/i18n';
import { useFlagGrafanaDashboardSidebarExplicitOpen } from '@grafana/runtime/internal';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { getRepeatSourceObject, isRepeatCloneOrChildOf } from '../../utils/clone';
import { DashboardInteractions } from '../../utils/interactions';
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
import { EditActionsPopover } from './EditActionsPopover';

function TabEditActions({ tab }: { tab: TabItem }) {
  const styles = useStyles2(getActionStyles);
  const isRepeated = isRepeatCloneOrChildOf(tab);
  const onClickEdit = useCallback(() => {
    DashboardInteractions.trackDashboardSectionAction('settings', 'tab', 'edit_popover');
    getDashboardSceneLike(tab).state.sidebar.openElementSettings(getRepeatSourceObject(tab));
  }, [tab]);

  return (
    <>
      <SettingsActionButton
        onClick={onClickEdit}
        tooltip={t('dashboard-scene.tab-edit-actions.tooltip-tab-settings', 'Tab settings')}
      />
      <div className={styles.actionsDivider} />
      <CopyActionButton
        onClick={() => {
          DashboardInteractions.trackDashboardSectionAction('copy', 'tab', 'edit_popover');
          tab.onCopy();
        }}
        disabled={isRepeated}
        disabledTooltip={t(
          'dashboard-scene.tab-edit-actions.copy-disabled',
          "Repeated tabs can't be copied individually"
        )}
      />
      <DuplicateActionButton
        onClick={() => {
          DashboardInteractions.trackDashboardSectionAction('duplicate', 'tab', 'edit_popover');
          tab.onDuplicate();
        }}
        disabled={isRepeated}
        disabledTooltip={t(
          'dashboard-scene.tab-edit-actions.duplicate-disabled',
          "Repeated tabs can't be duplicated individually"
        )}
      />
      <DeleteActionButton
        title={t('dashboard.tabs-layout.delete-tab-title', 'Delete tab?')}
        text={t(
          'dashboard.tabs-layout.delete-tab-text',
          'Deleting this tab will also remove all panels. Are you sure you want to continue?'
        )}
        yesText={t('dashboard.tabs-layout.delete-tab-yes', 'Delete')}
        confirm={tab.getLayout().getVizPanels().length > 0}
        onConfirm={() => {
          tab.onDelete();
          DashboardInteractions.trackDeleteDashboardElement('tab', 'edit_popover');
        }}
        disabled={isRepeated}
        disabledTooltip={t(
          'dashboard-scene.tab-edit-actions.delete-disabled',
          "Repeated tabs can't be deleted individually"
        )}
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
  const sidebarExplicitOpen = useFlagGrafanaDashboardSidebarExplicitOpen();
  const { getPortalRoot, getSidebarShiftPadding } = useEditActionsLayout();

  return (
    <EditActionsPopover
      keyboardAccessible
      content={<TabEditActions tab={tab} />}
      disabled={!sidebarExplicitOpen || disabled}
      portalRoot={getPortalRoot}
      zIndex={theme.zIndex.dropdown}
      shiftPadding={getSidebarShiftPadding}
    >
      {children}
    </EditActionsPopover>
  );
}

import { type JSX, useCallback } from 'react';

import { t } from '@grafana/i18n';
import { useFlagGrafanaDashboardSidebarExplicitOpen } from '@grafana/runtime/internal';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { DashboardInteractions } from '../../utils/interactions';
import { type RowItem } from '../layout-rows/RowItem';
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

export type SectionKind = 'row' | 'tab';

type SectionItem = RowItem | TabItem;

// Translation keys must stay literal for extraction, so each kind spells out its own strings.
function getSectionStrings(kind: SectionKind) {
  if (kind === 'row') {
    return {
      settings: t('dashboard-scene.row-edit-actions.tooltip-row-settings', 'Row settings'),
      copyDisabled: t('dashboard-scene.row-edit-actions.copy-disabled', "Repeated rows can't be copied individually"),
      duplicateDisabled: t(
        'dashboard-scene.row-edit-actions.duplicate-disabled',
        "Repeated rows can't be duplicated individually"
      ),
      deleteTitle: t('dashboard.rows-layout.delete-row-title', 'Delete row?'),
      deleteText: t(
        'dashboard.rows-layout.delete-row-text',
        'Deleting this row will also remove all panels. Are you sure you want to continue?'
      ),
      deleteYes: t('dashboard.rows-layout.delete-row-yes', 'Delete'),
      deleteDisabled: t(
        'dashboard-scene.row-edit-actions.delete-disabled',
        "Repeated rows can't be deleted individually"
      ),
    };
  }

  return {
    settings: t('dashboard-scene.tab-edit-actions.tooltip-tab-settings', 'Tab settings'),
    copyDisabled: t('dashboard-scene.tab-edit-actions.copy-disabled', "Repeated tabs can't be copied individually"),
    duplicateDisabled: t(
      'dashboard-scene.tab-edit-actions.duplicate-disabled',
      "Repeated tabs can't be duplicated individually"
    ),
    deleteTitle: t('dashboard.tabs-layout.delete-tab-title', 'Delete tab?'),
    deleteText: t(
      'dashboard.tabs-layout.delete-tab-text',
      'Deleting this tab will also remove all panels. Are you sure you want to continue?'
    ),
    deleteYes: t('dashboard.tabs-layout.delete-tab-yes', 'Delete'),
    deleteDisabled: t(
      'dashboard-scene.tab-edit-actions.delete-disabled',
      "Repeated tabs can't be deleted individually"
    ),
  };
}

function SectionEditActions({ kind, item }: { kind: SectionKind; item: SectionItem }) {
  const styles = useStyles2(getActionStyles);
  const strings = getSectionStrings(kind);
  const isRepeated = isRepeatCloneOrChildOf(item);
  const onClickEdit = useCallback(() => {
    DashboardInteractions.trackDashboardSectionAction('settings', kind, 'edit_popover');
    getDashboardSceneLike(item).state.sidebar.openElementSettings(item);
  }, [item, kind]);

  return (
    <>
      <SettingsActionButton onClick={onClickEdit} tooltip={strings.settings} />
      <div className={styles.actionsDivider} />
      <CopyActionButton
        onClick={() => {
          DashboardInteractions.trackDashboardSectionAction('copy', kind, 'edit_popover');
          item.onCopy();
        }}
        disabled={isRepeated}
        disabledTooltip={strings.copyDisabled}
      />
      <DuplicateActionButton
        onClick={() => {
          DashboardInteractions.trackDashboardSectionAction('duplicate', kind, 'edit_popover');
          item.onDuplicate();
        }}
        disabled={isRepeated}
        disabledTooltip={strings.duplicateDisabled}
      />
      <DeleteActionButton
        title={strings.deleteTitle}
        text={strings.deleteText}
        yesText={strings.deleteYes}
        confirm={item.getLayout().getVizPanels().length > 0}
        onConfirm={() => {
          item.onDelete();
          DashboardInteractions.trackDeleteDashboardElement(kind, 'edit_popover');
        }}
        disabled={isRepeated}
        disabledTooltip={strings.deleteDisabled}
      />
    </>
  );
}

export function SectionEditActionsWrapper({
  kind,
  item,
  disabled,
  children,
}: {
  kind: SectionKind;
  item: SectionItem;
  disabled?: boolean;
  children: JSX.Element;
}) {
  const theme = useTheme2();
  const sidebarExplicitOpen = useFlagGrafanaDashboardSidebarExplicitOpen();
  const { getPortalRoot, getSidebarShiftPadding } = useEditActionsLayout();

  return (
    <EditActionsPopover
      keyboardAccessible
      content={<SectionEditActions kind={kind} item={item} />}
      disabled={!sidebarExplicitOpen || disabled}
      portalRoot={getPortalRoot}
      zIndex={theme.zIndex.dropdown}
      shiftPadding={getSidebarShiftPadding}
    >
      {children}
    </EditActionsPopover>
  );
}

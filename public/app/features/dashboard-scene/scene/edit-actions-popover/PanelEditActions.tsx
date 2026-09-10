import { cx } from '@emotion/css';
import { useCallback, useMemo, type JSX } from 'react';

import { t, Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { type VizPanel } from '@grafana/scenes';
import { Button, Text, useStyles2, useTheme2 } from '@grafana/ui';

import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { getLayoutManagerFor } from '../../utils/getLayoutManagerFor';
import { DashboardInteractions } from '../../utils/interactions';
import { getPanelIdForVizPanel } from '../../utils/utils-panels';
import { useSelectionCountFor } from '../layouts-shared/useIsMultiSelection';
import { getDashboardSceneLike } from '../types/dashboard';

import {
  CopyActionButton,
  DeleteActionButton,
  DuplicateActionButton,
  getActionStyles,
  BulkActionsButton,
  SettingsActionButton,
} from './EditActions';
import { useEditActionsLayout } from './EditActionsLayoutContext';
import { EditActionsPopover, useHoverPopoverSupported } from './EditActionsPopover';

export function PanelEditActionsSingle({ panel }: { panel: VizPanel }) {
  const styles = useStyles2(getActionStyles);
  const isRepeated = isRepeatCloneOrChildOf(panel);

  const onClickEdit = useCallback(() => {
    getDashboardSceneLike(panel).state.sidebar.editElement(panel.state.key!);
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
        disabled={isRepeated}
      />
    </>
  );
}

export function PanelEditActionsBulk({ panel, selectionCount }: { panel: VizPanel; selectionCount: number }) {
  const styles = useStyles2(getActionStyles);

  const onClickBulkActions = useCallback(() => {
    getDashboardSceneLike(panel).state.sidebar.editSelection();
  }, [panel]);

  return (
    <>
      <Text element="p" variant="bodySmall" color="secondary">
        <Trans
          i18nKey="dashboard-scene.panel-edit-actions.elements-selected"
          count={selectionCount}
          tOptions={{
            defaultValue_one: '{{count}} element selected',
            defaultValue_other: '{{count}} elements selected',
          }}
        >
          {'{{count}}'} elements selected
        </Trans>
      </Text>
      <div className={styles.actionsDivider} />
      <BulkActionsButton onClick={onClickBulkActions} />
    </>
  );
}

export function PanelEditActionsWrapper({ panel, children }: { panel: VizPanel; children: JSX.Element }) {
  const theme = useTheme2();
  const selectionCount = useSelectionCountFor(panel.state.key);
  const isPopoverSupported = useHoverPopoverSupported();
  const { getPortalRoot, getSidebarShiftPadding } = useEditActionsLayout();

  const editActions = useMemo(
    () =>
      selectionCount > 1 ? (
        <PanelEditActionsBulk panel={panel} selectionCount={selectionCount} />
      ) : (
        <PanelEditActionsSingle panel={panel} />
      ),
    [panel, selectionCount]
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

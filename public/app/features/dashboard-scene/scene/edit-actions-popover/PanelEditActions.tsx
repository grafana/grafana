import { cx } from '@emotion/css';
import { useMemo, type JSX } from 'react';

import { t, Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { type VizPanel } from '@grafana/scenes';
import { Button, Text, useStyles2, useTheme2 } from '@grafana/ui';

import { getEditableElementFor } from '../../actions/utils/getEditableElementFor';
import { getRenderedInstanceCount, isRepeatCloneOrChildOf } from '../../utils/clone';
import { getLayoutManagerFor } from '../../utils/getLayoutManagerFor';
import { DashboardInteractions } from '../../utils/interactions';
import { getPanelIdForVizPanel } from '../../utils/utils-panels';
import { useGroupSelection } from '../layouts-shared/GroupSelectedActions';
import { useSelectedPanelsFor, useSelectionCountFor } from '../layouts-shared/useIsMultiSelection';
import { isBulkActionElement } from '../types/BulkActionElement';
import { getDashboardSceneLike } from '../types/dashboard';

import {
  CopyActionButton,
  DeleteActionButton,
  DuplicateActionButton,
  getActionStyles,
  GroupActionButton,
  SettingsActionButton,
} from './EditActions';
import { useEditActionsLayout } from './EditActionsLayoutContext';
import { EditActionsPopover, useHoverPopoverSupported } from './EditActionsPopover';

export function PanelEditActionsWrapper({ panel, children }: { panel: VizPanel; children: JSX.Element }) {
  const theme = useTheme2();
  // Repeat clones are selected through their source panel, so the selection never holds a clone key.
  const selectionCount = useSelectionCountFor(panel.state.repeatSourceKey ?? panel.state.key);
  const isPopoverSupported = useHoverPopoverSupported();
  const { getPortalRoot, getSidebarShiftPadding } = useEditActionsLayout();

  // Branching stays on the selected element count so a lone repeat keeps the single panel actions.
  const editActions = useMemo(
    () => (selectionCount > 1 ? <PanelEditActionsBulk panel={panel} /> : <PanelEditActionsSingle panel={panel} />),
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

export function PanelEditActionsSingle({ panel }: { panel: VizPanel }) {
  const styles = useStyles2(getActionStyles);
  const isRepeated = isRepeatCloneOrChildOf(panel);

  const onClickEdit = () => {
    DashboardInteractions.panelActionClicked('settings', getPanelIdForVizPanel(panel), 'edit_popover');
    const { selectionContext } = getDashboardSceneLike(panel).state.sidebar.state;
    selectionContext.onSelect({ id: panel.state.key! }, { force: true });
  };

  const onClickEditVisualization = () => {
    const panelId = getPanelIdForVizPanel(panel);
    DashboardInteractions.panelActionClicked('configure', panelId, 'edit_popover');
    locationService.partial({ editPanel: panelId });
  };

  const onClickCopy = () => {
    const panelId = getPanelIdForVizPanel(panel);
    DashboardInteractions.panelActionClicked('copy', panelId, 'edit_popover');
    getDashboardSceneLike(panel).copyPanel(panel);
  };

  const onClickDuplicate = () => {
    const panelId = getPanelIdForVizPanel(panel);
    DashboardInteractions.panelActionClicked('duplicate', panelId, 'edit_popover');
    getLayoutManagerFor(panel).duplicatePanel?.(panel);
  };

  const onClickDelete = () => {
    const panelId = getPanelIdForVizPanel(panel);
    DashboardInteractions.panelActionClicked('delete', panelId, 'edit_popover');
    // Same element type name the sidebar reports, so removals stay comparable across both surfaces.
    DashboardInteractions.trackDeleteDashboardElement(t('dashboard.sidebar.elements.panel', 'Panel'), 'edit_popover');
    getLayoutManagerFor(panel).removePanel?.(panel);
  };

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
      <CopyActionButton
        onClick={onClickCopy}
        disabled={isRepeated}
        disabledTooltip={t(
          'dashboard-scene.control-edit-actions.copied-tooltip-disabled',
          "Repeated panels can't be copied individually"
        )}
      />
      <DuplicateActionButton
        onClick={onClickDuplicate}
        disabled={isRepeated}
        disabledTooltip={t(
          'dashboard-scene.control-edit-actions.duplicate-tooltip-disabled',
          "Repeated panels can't be duplicated individually"
        )}
      />
      <DeleteActionButton
        title={t('dashboard.sidebar.viz-panel.delete-panel-title', 'Delete panel?')}
        text={t(
          'dashboard.sidebar.viz-panel.delete-panel-text',
          'Deleting this panel will also remove all queries. Are you sure you want to continue?'
        )}
        yesText={t('dashboard.sidebar.viz-panel.delete-panel-yes', 'Delete')}
        onConfirm={onClickDelete}
        disabled={isRepeated}
        disabledTooltip={t(
          'dashboard-scene.control-edit-actions.delete-tooltip-disabled',
          "Repeated panels can't be deleted individually"
        )}
      />
    </>
  );
}

export function PanelEditActionsBulk({ panel }: { panel: VizPanel }) {
  const styles = useStyles2(getActionStyles);

  const panels = useSelectedPanelsFor(panel);
  const panelCount = panels.reduce((total, panel) => total + getRenderedInstanceCount(panel), 0);
  const { rowGrouping, tabGrouping, group } = useGroupSelection(panels, 'edit_popover');

  const onClickDelete = () => {
    panels.forEach((panel) => {
      const element = getEditableElementFor(panel);
      if (element && isBulkActionElement(element)) {
        element.onDelete('edit_popover');
      }
    });
  };

  return (
    <>
      <Text element="p" variant="bodySmall" color="secondary">
        <Trans
          i18nKey="dashboard-scene.panel-edit-actions.panels-selected"
          count={panelCount}
          tOptions={{
            defaultValue_one: '{{count}} panel selected',
            defaultValue_other: '{{count}} panels selected',
          }}
        >
          {'{{count}}'} panels selected
        </Trans>
      </Text>
      <div className={styles.actionsDivider} />
      <GroupActionButton
        icon="list-ul"
        label={t('dashboard.sidebar.group.into-row', 'Group into row')}
        disabled={!rowGrouping.enabled}
        tooltip={!rowGrouping.enabled ? rowGrouping.reason : undefined}
        onClick={() => group('row')}
      />
      <GroupActionButton
        icon="layers"
        label={t('dashboard.sidebar.group.into-tab', 'Group into tab')}
        disabled={!tabGrouping.enabled}
        tooltip={!tabGrouping.enabled ? tabGrouping.reason : undefined}
        onClick={() => group('tab')}
      />
      <div className={styles.actionsDivider} />
      <DeleteActionButton
        title={t('dashboard.sidebar.elements.multiple-panels', 'Multiple panels')}
        text={t(
          'dashboard.sidebar.elements.multiple-panels-delete-text',
          'Are you sure you want to delete these panels? All queries will be removed.'
        )}
        yesText={t('dashboard.sidebar.viz-panel.delete-panel-yes', 'Delete')}
        onConfirm={onClickDelete}
      />
    </>
  );
}

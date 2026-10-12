import { useCallback, type JSX } from 'react';
import { useAsync } from 'react-use';

import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { type VizPanel, VizPanelHeaderMenuScope } from '@grafana/scenes';
import { Dropdown, IconButton, useStyles2, useTheme2 } from '@grafana/ui';
import { getTrackingSource, shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';

import { openShareDrawer } from '../../sharing/ShareDrawer/openShareDrawer';
import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { DashboardInteractions } from '../../utils/interactions';
import { tryGetExploreUrlForPanel } from '../../utils/urlBuilders';
import { getDashboardSceneFor } from '../../utils/utils';
import { getPanelIdForVizPanel } from '../../utils/utils-panels';
import { markViewPanelEnter, markViewPanelExit } from '../../utils/viewPanelTracking';
import { DashboardScene } from '../DashboardScene';

import { CopyActionButton, DeleteActionButton, DuplicateActionButton, getActionStyles } from './EditActions';
import { useEditActionsLayout } from './EditActionsLayoutContext';
import { EditActionsPopover, useEditActionsPopover, useHoverPopoverSupported } from './EditActionsPopover';
import { usePanelEditActionHandlers } from './usePanelEditActionHandlers';

const SOURCE = 'hover_popover';

/**
 * Experimental (grafana.panelHoverActions): a single hover popover for all panel actions, in both view and edit mode.
 * It promotes the most used actions, folds the panel menu in behind "more", and replaces the header menu button.
 */
export function PanelHoverActionsWrapper({
  panel,
  isViewPanel = false,
  children,
}: {
  panel: VizPanel;
  /** Rendered through the view panel path, which the solo panel page (/d-solo) shares */
  isViewPanel?: boolean;
  children: JSX.Element;
}) {
  const theme = useTheme2();
  const isPopoverSupported = useHoverPopoverSupported();
  const { getPortalRoot, getSidebarShiftPadding } = useEditActionsLayout();
  const root = panel.getRoot();
  // Re-render when the dashboard enters or leaves view/edit mode
  root.useState();
  const dashboard = root instanceof DashboardScene ? root : undefined;
  const { viewPanel, isEditing } = dashboard?.state ?? {};
  const { menu } = panel.useState();

  // Panels without a menu (e.g. public dashboards) have no actions to offer
  const isEnabled = isPopoverSupported && Boolean(dashboard) && Boolean(menu) && (!isViewPanel || Boolean(viewPanel));

  const content =
    isEditing && !viewPanel ? <PanelHoverEditActions panel={panel} /> : <PanelHoverViewActions panel={panel} />;

  return (
    // The popover's "more" replaces the header menu button on hover; keyboard focus still reveals that button
    <VizPanelHeaderMenuScope hideOnHover={isEnabled}>
      <EditActionsPopover
        content={content}
        disabled={!isEnabled}
        showOutsideEditMode
        placement="top-end"
        portalRoot={getPortalRoot}
        zIndex={theme.zIndex.dropdown}
        shiftPadding={getSidebarShiftPadding}
      >
        {children}
      </EditActionsPopover>
    </VizPanelHeaderMenuScope>
  );
}

function PanelHoverViewActions({ panel }: { panel: VizPanel }) {
  const styles = useStyles2(getActionStyles);
  const { closePopover } = useEditActionsPopover();
  const dashboard = getDashboardSceneFor(panel);
  const { viewPanel } = dashboard.useState();
  const panelId = getPanelIdForVizPanel(panel);
  const isMaximized = Boolean(viewPanel);
  const canEdit = dashboard.canEditDashboard() && dashboard.state.editable && !isRepeatCloneOrChildOf(panel);
  const exploreUrl = useAsync(() => tryGetExploreUrlForPanel(panel), [panel]).value;

  const onToggleMaximize = useCallback(() => {
    closePopover();
    if (isMaximized) {
      DashboardInteractions.panelActionClicked('restore', panelId, SOURCE);
      markViewPanelExit(SOURCE);
      locationService.partial({ viewPanel: null });
    } else {
      DashboardInteractions.panelActionClicked('maximize', panelId, SOURCE);
      markViewPanelEnter(SOURCE);
      locationService.partial({ viewPanel: panel.getPathId(), editPanel: undefined });
    }
  }, [closePopover, isMaximized, panel, panelId]);

  const onEdit = useCallback(() => {
    DashboardInteractions.panelActionClicked('edit', panelId, SOURCE, panel.state.pluginId);
    locationService.partial({ editPanel: panelId, viewPanel: undefined });
  }, [panel, panelId]);

  const onShare = useCallback(() => {
    closePopover();
    DashboardInteractions.panelActionClicked('share', panelId, SOURCE);
    DashboardInteractions.sharingCategoryClicked({
      item: shareDashboardType.link,
      shareResource: getTrackingSource(panel.getRef()),
    });
    openShareDrawer(dashboard, { shareView: shareDashboardType.link, panelRef: panel.getRef() });
  }, [closePopover, dashboard, panel, panelId]);

  const onExplore = useCallback(() => {
    if (!exploreUrl) {
      return;
    }
    DashboardInteractions.panelActionClicked('explore', panelId, SOURCE);
    locationService.push(locationUtil.stripBaseFromUrl(exploreUrl));
  }, [exploreUrl, panelId]);

  return (
    <>
      <IconButton
        name={isMaximized ? 'compress-alt' : 'expand-alt'}
        variant="secondary"
        size="md"
        className={styles.action}
        onClick={onToggleMaximize}
        tooltip={
          isMaximized
            ? t('dashboard-scene.panel-hover-actions.restore', 'Back to dashboard')
            : t('dashboard-scene.panel-hover-actions.maximize', 'View panel')
        }
        tooltipPlacement="top"
      />
      {canEdit && (
        <IconButton
          name="edit"
          variant="secondary"
          size="md"
          className={styles.action}
          onClick={onEdit}
          tooltip={t('dashboard-scene.panel-hover-actions.edit', 'Edit')}
          tooltipPlacement="top"
        />
      )}
      <IconButton
        name="share-alt"
        variant="secondary"
        size="md"
        className={styles.action}
        onClick={onShare}
        tooltip={t('dashboard-scene.panel-hover-actions.share', 'Share link')}
        tooltipPlacement="top"
      />
      {exploreUrl && (
        <IconButton
          name="compass"
          variant="secondary"
          size="md"
          className={styles.action}
          onClick={onExplore}
          tooltip={t('dashboard-scene.panel-hover-actions.explore', 'Explore')}
          tooltipPlacement="top"
        />
      )}
      <PanelMenuButton panel={panel} />
    </>
  );
}

function PanelHoverEditActions({ panel }: { panel: VizPanel }) {
  const styles = useStyles2(getActionStyles);
  const isRepeated = isRepeatCloneOrChildOf(panel);
  const { onClickEdit, onClickEditVisualization, onClickCopy, onClickDuplicate, onClickDelete } =
    usePanelEditActionHandlers(panel, SOURCE);

  return (
    <>
      <IconButton
        name="cog"
        variant="secondary"
        size="md"
        className={styles.action}
        onClick={onClickEdit}
        tooltip={t('dashboard-scene.control-edit-actions.settings', 'Settings')}
        tooltipPlacement="top"
      />
      <IconButton
        name="edit"
        variant="secondary"
        size="md"
        className={styles.action}
        onClick={onClickEditVisualization}
        tooltip={t('dashboard-scene.panel-edit-actions.edit-visualization', 'Edit visualization')}
        tooltipPlacement="top"
      />
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
      <PanelMenuButton panel={panel} />
    </>
  );
}

/**
 * Opens the regular panel menu (same items as the header menu button, which this popover hides).
 */
function PanelMenuButton({ panel }: { panel: VizPanel }) {
  const styles = useStyles2(getActionStyles);
  const { menu } = panel.useState();
  const { closePopover, setKeepOpen } = useEditActionsPopover();

  const onVisibleChange = useCallback(
    (visible: boolean) => {
      if (visible) {
        DashboardInteractions.panelActionClicked('more', getPanelIdForVizPanel(panel), SOURCE);
        setKeepOpen(true);
      } else {
        closePopover();
      }
    },
    [closePopover, panel, setKeepOpen]
  );

  if (!menu) {
    return null;
  }

  return (
    <Dropdown overlay={() => <menu.Component model={menu} />} placement="bottom-end" onVisibleChange={onVisibleChange}>
      <IconButton
        name="ellipsis-v"
        variant="secondary"
        size="md"
        className={styles.action}
        tooltip={t('dashboard-scene.panel-hover-actions.more', 'More actions')}
        tooltipPlacement="top"
      />
    </Dropdown>
  );
}

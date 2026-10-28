import { css, cx } from '@emotion/css';
import { type JSX, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { type GrafanaTheme2, locationUtil } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useFlagGrafanaPanelActionsPopover } from '@grafana/runtime/internal';
import { type VizPanel, type VizPanelMenu } from '@grafana/scenes';
import { Dropdown, ElementSelectionContext, IconButton, useStyles2, useTheme2 } from '@grafana/ui';
import { PanelChromeHeaderControlsContext } from '@grafana/ui/internal';

import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { DashboardInteractions } from '../../utils/interactions';
import { tryGetExploreUrlForPanel } from '../../utils/urlBuilders';
import { getPanelIdForVizPanel } from '../../utils/utils-panels';
import { DashboardScene } from '../DashboardScene';
import { VizPanelHeaderActions } from '../VizPanelHeaderActions';
import { dashboardModesEnabled, isViewingDashboard } from '../dashboardModes';
import { PanelGroupByPicker } from '../panel-actions/PanelGroupByAction/PanelGroupByAction';
import { isFullDashboardEditing } from '../types/dashboard';

import { CopyActionButton, DeleteActionButton, DuplicateActionButton, getActionStyles } from './EditActions';
import { useEditActionsLayout } from './EditActionsLayoutContext';
import { EditActionsPopover } from './EditActionsPopover';
import {
  PanelActionsOverlayProvider,
  usePanelActionsOverlayOpenChange,
  usePanelActionsOverlays,
} from './PanelActionsOverlayContext';
import { PanelEditActionsWrapper } from './PanelEditActions';

const POPOVER_OFFSET = { mainAxis: -8, alignmentAxis: 8 };

type PanelActionItem =
  | 'view'
  | 'restore'
  | 'edit'
  | 'explore'
  | 'settings'
  | 'copy'
  | 'duplicate'
  | 'delete'
  | 'more_actions';

/**
 * Wraps a dashboard panel with its hover actions: the panel actions popover when `grafana.panelActionsPopover`
 * is on, otherwise the edit-mode-only panel edit actions.
 */
export function PanelActionsWrapper({ panel, children }: { panel: VizPanel; children: JSX.Element }) {
  const isActionsPopoverEnabled = useFlagGrafanaPanelActionsPopover();
  const root = panel.getRoot();

  if (!isActionsPopoverEnabled || !(root instanceof DashboardScene)) {
    return <PanelEditActionsWrapper panel={panel}>{children}</PanelEditActionsWrapper>;
  }

  return (
    <PanelActionsPopoverWrapper panel={panel} dashboard={root}>
      {children}
    </PanelActionsPopoverWrapper>
  );
}

function PanelActionsPopoverWrapper({
  panel,
  dashboard,
  children,
}: {
  panel: VizPanel;
  dashboard: DashboardScene;
  children: JSX.Element;
}) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { getPortalRoot, getSidebarShiftPadding } = useEditActionsLayout();
  const { viewPanel, meta } = dashboard.useState();
  const { menu } = panel.useState();
  const [hoverSlot, setHoverSlot] = useState<HTMLElement | null>(null);
  const { hasOpenOverlay, setOverlayOpen } = usePanelActionsOverlays();
  // Read in the same render as the menu closing, so opening the picker from the menu never lets the popover close.
  const isGroupByPickerOpen = useIsGroupByPickerOpen(panel);

  const isExpanded = Boolean(viewPanel);
  const headerControls = useMemo(
    () => ({ external: true, hoverSlot, hideDragHandle: isExpanded }),
    [hoverSlot, isExpanded]
  );

  // Public dashboards have no panel menu and embedded dashboards only offer Explore, so they keep the panel header.
  if (!menu || meta.isEmbedded) {
    return children;
  }

  return (
    <PanelActionsOverlayProvider value={setOverlayOpen}>
      <PanelChromeHeaderControlsContext.Provider value={headerControls}>
        <EditActionsPopover
          content={
            <PanelActions
              panel={panel}
              dashboard={dashboard}
              menu={menu}
              hoverSlot={hoverSlot}
              onHoverSlotChange={setHoverSlot}
            />
          }
          showOutsideEditMode
          keyboardAccessible
          openOnTap
          keepOpen={hasOpenOverlay || isGroupByPickerOpen}
          placement="top-end"
          offset={POPOVER_OFFSET}
          portalRoot={getPortalRoot}
          zIndex={theme.zIndex.dropdown}
          shiftPadding={getSidebarShiftPadding}
          ariaLabel={t('dashboard-scene.panel-actions-popover.aria-label', 'Panel actions')}
          actionsClassName={styles.actions}
        >
          {children}
        </EditActionsPopover>
      </PanelChromeHeaderControlsContext.Provider>
    </PanelActionsOverlayProvider>
  );
}

interface PanelActionsProps {
  panel: VizPanel;
  dashboard: DashboardScene;
  menu: VizPanelMenu;
  hoverSlot: HTMLElement | null;
  onHoverSlotChange: (element: HTMLElement | null) => void;
}

function PanelActions({ panel, dashboard, menu, hoverSlot, onHoverSlotChange }: PanelActionsProps) {
  const onMenuOpenChange = usePanelActionsOverlayOpenChange();
  const [moreActionsAnchor, setMoreActionsAnchor] = useState<HTMLElement | null>(null);
  const isGroupByPickerOpen = useIsGroupByPickerOpen(panel);
  const headerActions = getHeaderActions(panel);

  // A picker left open when the popover closes would otherwise reappear the next time it opens.
  useEffect(() => () => headerActions?.closeGroupByPicker(), [headerActions]);
  const styles = useStyles2(getStyles);
  const actionStyles = useStyles2(getActionStyles);
  const dashboardState = dashboard.useState();
  const { viewPanel, editable } = dashboardState;
  const isEditing = isFullDashboardEditing(dashboardState);
  const { hoverHeader, title } = panel.useState();
  const isSelectionEnabled = Boolean(useContext(ElementSelectionContext)?.enabled);
  const hasHoverSlotItems = useHasVisibleItems(hoverSlot);

  const isExpanded = Boolean(viewPanel);
  const isRepeat = isRepeatCloneOrChildOf(panel);
  const canEdit = dashboard.canEditDashboard() && Boolean(editable) && !isRepeat;
  const canChangeLayout = Boolean(isEditing) && !isRepeat;
  const panelId = getPanelIdForVizPanel(panel);
  const titleText = panel.interpolate(title, undefined, 'text');

  const exploreUrl = useAsync(
    async () => (isEditing ? undefined : tryGetExploreUrlForPanel(panel)),
    [panel, isEditing]
  ).value;

  const canExplore = !isEditing && Boolean(exploreUrl);
  const canOpenSettings = Boolean(isEditing) && isSelectionEnabled;

  const report = useCallback(
    (item: PanelActionItem) => DashboardInteractions.panelActionClicked(item, panelId, 'actions_popover'),
    [panelId]
  );

  const onToggleExpand = () => {
    if (isExpanded) {
      report('restore');
      locationService.partial({ viewPanel: undefined });
    } else {
      report('view');
      locationService.partial({ viewPanel: panel.getPathId(), editPanel: undefined });
    }
  };

  const onEdit = () => {
    if (dashboardModesEnabled() && isViewingDashboard(dashboard.state)) {
      dashboard.setDashboardMode('edit', 'panel_menu');
    }
    DashboardInteractions.panelActionClicked('edit', panelId, 'actions_popover', panel.state.pluginId);
    locationService.partial({ editPanel: panelId, viewPanel: undefined });
  };

  const onExplore = () => {
    if (exploreUrl) {
      report('explore');
      locationService.push(locationUtil.stripBaseFromUrl(exploreUrl));
    }
  };

  const onSettings = () => {
    report('settings');
    dashboard.state.sidebar.state.selectionContext.onSelect({ id: panel.state.key! }, { force: true });
  };

  const onRemove = () => {
    report('delete');
    if (isExpanded) {
      locationService.partial({ viewPanel: undefined });
    }
    dashboard.removePanel(panel);
  };

  const onMenuVisibleChange = (isVisible: boolean) => {
    onMenuOpenChange(isVisible);
    if (isVisible) {
      report('more_actions');
    }
  };

  return (
    <>
      {hoverHeader && <div ref={onHoverSlotChange} className={styles.hoverSlot} />}
      {hoverHeader && hasHoverSlotItems && <ActionsSeparator />}

      <IconButton
        name={isExpanded ? 'compress-alt' : 'expand-alt'}
        size="md"
        className={actionStyles.action}
        tooltip={
          isExpanded
            ? t('dashboard-scene.panel-actions-popover.restore-size', 'Restore size (v)')
            : t('dashboard-scene.panel-actions-popover.expand', 'Expand (v)')
        }
        tooltipPlacement="top"
        onClick={onToggleExpand}
      />

      {(canEdit || canExplore || canOpenSettings) && <ActionsSeparator />}

      {canEdit && (
        <IconButton
          name="edit"
          size="md"
          className={actionStyles.action}
          tooltip={t('dashboard-scene.panel-actions-popover.edit', 'Edit (e)')}
          tooltipPlacement="top"
          onClick={onEdit}
        />
      )}

      {canExplore && (
        <IconButton
          name="compass"
          size="md"
          className={actionStyles.action}
          tooltip={t('dashboard-scene.panel-actions-popover.explore', 'Explore (p x)')}
          tooltipPlacement="top"
          onClick={onExplore}
        />
      )}

      {canOpenSettings && (
        <IconButton
          name="cog"
          size="md"
          className={actionStyles.action}
          tooltip={t('dashboard-scene.panel-actions-popover.settings', 'Settings')}
          tooltipPlacement="top"
          onClick={onSettings}
        />
      )}

      {canChangeLayout && (
        <>
          <ActionsSeparator />
          <CopyActionButton
            onClick={() => {
              report('copy');
              dashboard.copyPanel(panel);
            }}
          />
          <DuplicateActionButton
            onClick={() => {
              report('duplicate');
              dashboard.duplicatePanel(panel);
            }}
          />
          <DeleteActionButton
            title={t('dashboard-scene.on-remove-panel.title.remove-panel', 'Remove panel')}
            text={t('dashboard-scene.on-remove-panel.text.remove-panel', 'Are you sure you want to remove this panel?')}
            yesText={t('dashboard-scene.panel-actions-popover.remove-confirm', 'Remove')}
            tooltip={t('dashboard-scene.panel-actions-popover.remove', 'Remove (p r)')}
            onConfirm={onRemove}
          />
        </>
      )}

      <ActionsSeparator />

      <span ref={setMoreActionsAnchor} className={styles.moreActions}>
        <Dropdown
          overlay={() => <menu.Component model={menu} />}
          placement="bottom-end"
          onVisibleChange={onMenuVisibleChange}
        >
          <IconButton
            name="ellipsis-v"
            size="md"
            className={actionStyles.action}
            tooltip={t('dashboard-scene.panel-actions-popover.more-actions', 'More actions')}
            tooltipPlacement="top"
            data-testid={selectors.components.Panels.Panel.menu(titleText)}
          />
        </Dropdown>
      </span>

      {isGroupByPickerOpen && headerActions && moreActionsAnchor && (
        <PanelGroupByPicker
          {...headerActions.getGroupByVariables()}
          queries={headerActions.getQueryRunner()?.state.queries ?? []}
          referenceElement={moreActionsAnchor}
          placement="bottom-end"
          onClose={() => headerActions.closeGroupByPicker()}
        />
      )}
    </>
  );
}

function ActionsSeparator() {
  const styles = useStyles2(getStyles);
  const actionStyles = useStyles2(getActionStyles);
  return (
    <div role="separator" aria-orientation="vertical" className={cx(actionStyles.actionsDivider, styles.separator)} />
  );
}

/**
 * Whether an element shows any text or icon. Header items such as panel links keep their wrappers in the hover slot
 * while rendering nothing, so a slot with children can still look empty.
 */
function useHasVisibleItems(element: HTMLElement | null): boolean {
  const [hasItems, setHasItems] = useState(false);

  useEffect(() => {
    if (!element) {
      setHasItems(false);
      return;
    }
    const update = () =>
      setHasItems(Boolean(element.textContent?.trim()) || element.querySelector('svg, img') !== null);
    update();
    const observer = new MutationObserver(update);
    observer.observe(element, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [element]);

  return hasItems;
}

function getHeaderActions(panel: VizPanel): VizPanelHeaderActions | undefined {
  const { headerActions } = panel.state;
  return headerActions instanceof VizPanelHeaderActions ? headerActions : undefined;
}

function useIsGroupByPickerOpen(panel: VizPanel): boolean {
  const headerActions = getHeaderActions(panel);
  const [isOpen, setIsOpen] = useState(Boolean(headerActions?.state.isGroupByPickerOpen));

  useEffect(() => {
    if (!headerActions) {
      return;
    }
    setIsOpen(Boolean(headerActions.state.isGroupByPickerOpen));
    const sub = headerActions.subscribeToState((state) => setIsOpen(Boolean(state.isGroupByPickerOpen)));
    return () => sub.unsubscribe();
  }, [headerActions]);

  return isOpen;
}

const getStyles = (theme: GrafanaTheme2) => ({
  actions: css({
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    // The popover offset alone sets the 8px overlap with the panel's top edge.
    top: 0,
  }),
  moreActions: css({
    display: 'inline-flex',
  }),
  separator: css({
    backgroundColor: theme.colors.border.strong,
  }),
  hoverSlot: css({
    // Header items join the toolbar's flex layout and 8px gap; items that render nothing leave no gap.
    display: 'contents',
  }),
});

import { useCallback, useSyncExternalStore } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { type VizPanel } from '@grafana/scenes';
import { Button, Dropdown, Icon, Menu, PANEL_AD_HOC_TRANSFORMATIONS_OWNER } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import { getDashboardScenePageStateManager } from '../../pages/DashboardScenePageStateManager';
import { useSaveDashboard } from '../../saving/useSaveDashboard';
import { getDashboardSceneFor } from '../../utils/utils';

import { canPromoteAdHocChanges, promoteAdHocChanges } from './promoteAdHocChanges';

interface Props {
  panel: VizPanel;
}

/**
 * Shown when viewer-only interactions (such as hiding a table column) are changing how the panel looks.
 * Anyone can remove the changes; users who can save a v2 dashboard can also save them to the dashboard.
 */
export function PanelAdHocChangesAction({ panel }: Props) {
  const dashboard = getDashboardSceneFor(panel);
  const { meta } = dashboard.useState();
  // Re-render once the plugin has loaded so its declared interactions are available.
  panel.useState();
  const hasInteractions = Boolean(panel.getPlugin()?.panelInteractions);
  const hasChanges = useHasAdHocTransformations(panel, hasInteractions);
  const canPromote = Boolean(meta.canSave) && canPromoteAdHocChanges(dashboard);
  const { onSaveDashboard } = useSaveDashboard();
  const notifyApp = useAppNotification();

  const onSaveToDashboard = async () => {
    const promoted = promoteAdHocChanges(panel);
    if (!promoted) {
      return;
    }

    const result = await onSaveDashboard(dashboard, {
      folderUid: meta.folderUid,
      k8s: meta.k8s,
      rawDashboardJSON: promoted,
    });

    if (result?.status !== 'success') {
      notifyApp.error(t('panel-adhoc-changes.save-failed', 'Could not save view changes to the dashboard'));
      return;
    }

    // Read before reloading: the reload replaces this scene with one that starts in view mode.
    const wasEditing = dashboard.state.isEditing;
    const manager = getDashboardScenePageStateManager();
    // The cached scene already carries the saved version, so reload would otherwise skip rebuilding it.
    manager.removeSceneCache(result.uid);
    await manager.reloadDashboard(locationService.getSearchObject());

    if (wasEditing) {
      // Match a normal save, which keeps the dashboard in edit mode.
      manager.state.dashboard?.onEnterEditMode('user', 'restore');
    }
  };

  const onRemoveChanges = () => panel.getRuntimeTransformations().set(PANEL_AD_HOC_TRANSFORMATIONS_OWNER, []);

  if (!hasChanges) {
    return null;
  }

  const button = (
    <Button
      variant="secondary"
      size="sm"
      fill="text"
      icon="eye"
      tooltip={t('panel-adhoc-changes.tooltip', 'This panel has view changes that are not saved with the dashboard')}
      data-testid={selectors.components.Panels.Panel.PanelAdHocChangesHeaderAction}
    >
      <Trans i18nKey="panel-adhoc-changes.button">View changes</Trans>
      <Icon name="angle-down" />
    </Button>
  );

  return (
    // Header buttons sit inside the drag handle; keep clicks from starting a panel drag. This lives on a wrapper
    // because Dropdown replaces the pointer handlers of its child. The wrapper is not itself interactive.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <span
      onPointerDown={(ev) => ev.stopPropagation()}
      onPointerUp={(ev) => ev.stopPropagation()}
      onClick={(ev) => ev.stopPropagation()}
    >
      <Dropdown
        placement="bottom-end"
        overlay={
          <Menu>
            {canPromote && (
              <Menu.Item
                label={t('panel-adhoc-changes.save-to-dashboard', 'Save to dashboard')}
                onClick={onSaveToDashboard}
              />
            )}
            <Menu.Item label={t('panel-adhoc-changes.remove-changes', 'Remove changes')} onClick={onRemoveChanges} />
          </Menu>
        }
      >
        {button}
      </Dropdown>
    </span>
  );
}

function useHasAdHocTransformations(panel: VizPanel, enabled: boolean): boolean {
  const api = panel.getRuntimeTransformations();
  const subscribe = useCallback(
    (onChange: () => void) => (enabled ? api.subscribe(PANEL_AD_HOC_TRANSFORMATIONS_OWNER, onChange) : () => {}),
    [api, enabled]
  );
  const getSnapshot = useCallback(
    () => enabled && api.get(PANEL_AD_HOC_TRANSFORMATIONS_OWNER).length > 0,
    [api, enabled]
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}

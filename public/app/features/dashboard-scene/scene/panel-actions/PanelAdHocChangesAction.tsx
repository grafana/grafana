import { useCallback, useSyncExternalStore } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { Button, Dropdown, Icon, Menu } from '@grafana/ui';
import { TABLE_TRANSFORMATIONS_OWNER } from 'app/features/table/constants';

import { getDashboardSceneLike } from '../types/dashboard';

import { PromotePanelAdHocChangesEvent, canPromoteAdHocChanges } from './promote/utils';

interface Props {
  panel: VizPanel;
}

/**
 * Shown when viewer-only interactions (such as hiding a table column) are changing how the panel looks.
 * Anyone can remove the changes; users who can save the dashboard can also save them to it when promotion is supported.
 */
export function PanelAdHocChangesAction({ panel }: Props) {
  const { meta } = getDashboardSceneLike(panel).useState();
  // Re-render once the plugin has loaded so its declared interactions are available.
  panel.useState();
  const hasInteractions = Boolean(panel.getPlugin()?.panelInteractions);
  const hasChanges = useHasAdHocTransformations(panel, hasInteractions);
  const canPromote = Boolean(meta.canSave) && canPromoteAdHocChanges(panel);

  // The dashboard saves the changes, see usePromotePanelAdHocChanges.
  const onSaveToDashboard = useCallback(
    () => panel.publishEvent(new PromotePanelAdHocChangesEvent({ panel }), true),
    [panel]
  );

  const onRemoveChanges = useCallback(
    () => panel.getRuntimeTransformations().set(TABLE_TRANSFORMATIONS_OWNER, []),
    [panel]
  );

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
    (onChange: () => void) => (enabled ? api.subscribe(TABLE_TRANSFORMATIONS_OWNER, onChange) : () => {}),
    [api, enabled]
  );
  const getSnapshot = useCallback(() => enabled && api.get(TABLE_TRANSFORMATIONS_OWNER).length > 0, [api, enabled]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

import { useCallback, useSyncExternalStore } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { Button, Dropdown, Icon, Menu } from '@grafana/ui';

import { getDashboardSceneFor } from '../../utils/utils';

import { AD_HOC_TRANSFORMATIONS_OWNER, canPromoteAdHocChanges, promoteAdHocChanges } from './promoteAdHocChanges';

interface Props {
  panel: VizPanel;
}

/**
 * Shown when viewer-only interactions (such as hiding a table column) are changing how the panel looks.
 * Users who can save a v2 dashboard get a menu to save the changes.
 */
export function PanelAdHocChangesAction({ panel }: Props) {
  const dashboard = getDashboardSceneFor(panel);
  const { meta } = dashboard.useState();
  // Re-render once the plugin has loaded so its declared interactions are available.
  panel.useState();
  const hasInteractions = Boolean(panel.getPlugin()?.panelInteractions);
  const hasChanges = useHasAdHocTransformations(panel, hasInteractions);
  const canPromote = Boolean(meta.canSave) && canPromoteAdHocChanges(dashboard);

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
      {canPromote && <Icon name="angle-down" />}
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
      {canPromote ? (
        <Dropdown
          placement="bottom-end"
          overlay={
            <Menu>
              <Menu.Item
                label={t('panel-adhoc-changes.save-to-dashboard', 'Save to dashboard')}
                // Prototype: the promoted JSON is not saved yet.
                onClick={() => promoteAdHocChanges(panel)}
              />
            </Menu>
          }
        >
          {button}
        </Dropdown>
      ) : (
        button
      )}
    </span>
  );
}

function useHasAdHocTransformations(panel: VizPanel, enabled: boolean): boolean {
  const api = panel.getRuntimeTransformations();
  const subscribe = useCallback(
    (onChange: () => void) => (enabled ? api.subscribe(AD_HOC_TRANSFORMATIONS_OWNER, onChange) : () => {}),
    [api, enabled]
  );
  const getSnapshot = useCallback(() => enabled && api.get(AD_HOC_TRANSFORMATIONS_OWNER).length > 0, [api, enabled]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

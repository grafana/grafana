import { useCallback, useSyncExternalStore } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { Button, Dropdown, Icon, Menu } from '@grafana/ui';

import { getDashboardSceneFor } from '../../utils/utils';

interface Props {
  panel: VizPanel;
}

/**
 * Shown when viewer-only interactions (such as hiding a table column) are changing how the panel looks.
 * Users who can save the dashboard get a menu to save the changes.
 */
export function PanelAdHocChangesAction({ panel }: Props) {
  const { meta } = getDashboardSceneFor(panel).useState();
  // Re-render once the plugin has loaded so its declared interactions are available.
  panel.useState();
  const owner = panel.getPlugin()?.panelInteractions?.transformationsOwner;
  const hasChanges = useHasRuntimeTransformations(panel, owner);
  const canSave = Boolean(meta.canSave);

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
      {canSave && <Icon name="angle-down" />}
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
      {canSave ? (
        <Dropdown
          placement="bottom-end"
          overlay={
            <Menu>
              <Menu.Item
                label={t('panel-adhoc-changes.save-to-dashboard', 'Save to dashboard')}
                // Prototype: promotion is not implemented yet.
                onClick={() => {}}
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

function useHasRuntimeTransformations(panel: VizPanel, owner: string | undefined): boolean {
  const api = panel.getRuntimeTransformations();
  const subscribe = useCallback(
    (onChange: () => void) => (owner ? api.subscribe(owner, onChange) : () => {}),
    [api, owner]
  );
  const getSnapshot = useCallback(() => Boolean(owner && api.get(owner).length > 0), [api, owner]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

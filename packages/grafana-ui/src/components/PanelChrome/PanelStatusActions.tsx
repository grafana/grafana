import { type PanelStatusItem } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Button } from '../Button/Button';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';

import { usePanelContext } from './PanelContext';
import { usePanelStatusSnapshot } from './usePanelNotices';

/** Status actions for the inspector. @alpha */
export function PanelStatusActions({ statusItem }: { statusItem: PanelStatusItem }) {
  const { notices, onInvestigateStatusItem } = usePanelContext();
  const snapshot = usePanelStatusSnapshot(notices);
  const current = snapshot.items.find((item) => item.id === statusItem.id);
  if (
    !current ||
    !notices ||
    (!current.actions?.length && (!onInvestigateStatusItem || current.assistant === 'hidden'))
  ) {
    return null;
  }
  return (
    <Box marginTop={1.5}>
      <Stack direction="column" gap={1}>
        <Stack direction="row" gap={1} wrap="wrap">
          {current.actions?.map((action) => {
            const state = snapshot.actions[JSON.stringify([current.id, action.id])];
            return (
              <Button
                key={action.id}
                variant="secondary"
                disabled={action.disabled || state?.pending}
                aria-busy={state?.pending}
                tooltip={action.disabledReason}
                onClick={() => {
                  void notices.runAction(current.id, action.id);
                }}
              >
                {action.label}
              </Button>
            );
          })}
          {onInvestigateStatusItem && current.assistant !== 'hidden' && (
            <Button variant="secondary" icon="ai-sparkle" onClick={() => onInvestigateStatusItem(current.id)}>
              {current.severity === 'error'
                ? t('grafana-ui.panel-chrome.fix-with-assistant', 'Fix with Assistant')
                : t('grafana-ui.panel-chrome.explain-with-assistant', 'Explain with Assistant')}
            </Button>
          )}
        </Stack>
        {current.actions?.map((action) => {
          const error = snapshot.actions[JSON.stringify([current.id, action.id])]?.error;
          return error ? (
            <div key={action.id} role="alert">
              {action.label}: {error}
            </div>
          ) : null;
        })}
      </Stack>
    </Box>
  );
}

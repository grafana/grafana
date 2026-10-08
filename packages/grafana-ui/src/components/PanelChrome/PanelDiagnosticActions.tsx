import { type PanelDiagnosticEntry } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Button } from '../Button/Button';
import { Stack } from '../Layout/Stack/Stack';

import { usePanelContext } from './PanelContext';
import { usePanelDiagnosticsSnapshot } from './usePanelDiagnostics';

/** Diagnostic actions for the inspector. @alpha */
export function PanelDiagnosticActions({ diagnostic }: { diagnostic: PanelDiagnosticEntry }) {
  const { diagnostics, onInvestigateDiagnostic } = usePanelContext();
  const snapshot = usePanelDiagnosticsSnapshot(diagnostics);
  const current = snapshot.items.find((item) => item.id === diagnostic.id);
  if (!current || !diagnostics) {
    return null;
  }
  return (
    <Stack direction="column" gap={0.5}>
      <Stack direction="row" gap={0.5} wrap="wrap">
        {current.actions?.map((action) => {
          const state = snapshot.actions[JSON.stringify([current.id, action.id])];
          return (
            <Button
              key={action.id}
              size="sm"
              variant="secondary"
              disabled={action.disabled || state?.pending}
              aria-busy={state?.pending}
              tooltip={action.disabledReason}
              onClick={() => {
                void diagnostics.runAction(current.id, action.id);
              }}
            >
              {action.label}
            </Button>
          );
        })}
        {onInvestigateDiagnostic && current.assistant !== 'hidden' && (
          <Button size="sm" variant="secondary" icon="ai-sparkle" onClick={() => onInvestigateDiagnostic(current.id)}>
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
  );
}

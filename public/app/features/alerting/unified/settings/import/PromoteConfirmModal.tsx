import { Trans, t } from '@grafana/i18n';
import { Alert, ConfirmModal, Spinner, Stack, Text } from '@grafana/ui';

import { type DryRunValidationResult } from '../../components/import-to-gma/types';

import { StagedPromotePreview } from './StagedPromotePreview';
import { type StagedExtraConfig } from './stagedConfig';
import { usePromoteStagedConfig } from './usePromoteStagedConfig';
import { useStagedConfigDryRun } from './useStagedConfigDryRun';

interface Props {
  stagedConfig: StagedExtraConfig;
  /** The staged config comes from auto-sync, so promoting also ends the continuous sync. */
  isSyncManaged?: boolean;
  onDismiss: () => void;
}

/**
 * Confirmation modal for promoting a staged Alertmanager config into the live Grafana Alertmanager.
 * On open it dry-runs the promote to preview what will be merged and what gets renamed to avoid
 * conflicts, then merges on confirm.
 */
export function PromoteConfirmModal({ stagedConfig, isSyncManaged, onDismiss }: Props) {
  const { result, isLoading, error, isPreviewUnavailable } = useStagedConfigDryRun(stagedConfig);
  const { onConfirm, isSubmitting } = usePromoteStagedConfig(stagedConfig, isSyncManaged, onDismiss);

  // Enabled once the dry-run confirms the merge is valid, or the preview itself couldn't run for a
  // reason unrelated to whether the promote will succeed.
  const canPromote = !isLoading && !isSubmitting && (Boolean(result?.valid) || isPreviewUnavailable);

  return (
    <ConfirmModal
      isOpen
      title={t('alerting.settings.import.promote.title', 'Promote this configuration?')}
      confirmText={t('alerting.settings.import.promote.confirm', 'Promote to live config')}
      confirmVariant="primary"
      disabled={!canPromote}
      onConfirm={onConfirm}
      // Prevent dismissing mid-promote so the mutation can't be interrupted.
      onDismiss={isSubmitting ? () => {} : onDismiss}
      body={
        <Stack direction="column" gap={2}>
          <Alert
            severity="info"
            title={t(
              'alerting.settings.import.promote.merge-info',
              "Promoting merges this configuration into your live Grafana Alertmanager. This is a one-time action and can't be undone."
            )}
          />

          {isSyncManaged && (
            <Alert
              severity="warning"
              title={t('alerting.settings.import.promote.sync-stops-title', 'This will stop auto-sync')}
            >
              <Trans i18nKey="alerting.settings.import.promote.sync-stops-body">
                Once merged, the resources become normal Grafana resources and stop tracking the datasource. Auto-sync
                is turned off as part of the merge.
              </Trans>
            </Alert>
          )}

          <PromotePreviewBody
            isLoading={isLoading}
            error={error}
            isPreviewUnavailable={isPreviewUnavailable}
            result={result}
          />
        </Stack>
      }
    />
  );
}

export interface PromotePreviewBodyProps {
  isLoading: boolean;
  error?: string;
  isPreviewUnavailable: boolean;
  result?: DryRunValidationResult;
}

export type PreviewState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string }
  | { kind: 'invalid'; message?: string }
  | { kind: 'valid'; result: DryRunValidationResult }
  | { kind: 'idle' };

export function getPreviewState({
  isLoading,
  error,
  isPreviewUnavailable,
  result,
}: PromotePreviewBodyProps): PreviewState {
  if (isLoading) {
    return { kind: 'loading' };
  }
  if (error) {
    return isPreviewUnavailable ? { kind: 'unavailable' } : { kind: 'error', message: error };
  }
  if (result && !result.valid) {
    return { kind: 'invalid', message: result.error };
  }
  if (result?.valid) {
    return { kind: 'valid', result };
  }
  // Shouldn't be reachable once useStagedConfigDryRun resolves — kept for exhaustiveness.
  return { kind: 'idle' };
}

/** Dry-run preview: a loading spinner, an unavailable/error/invalid banner, or the merge preview. */
function PromotePreviewBody({ isLoading, error, isPreviewUnavailable, result }: PromotePreviewBodyProps) {
  // Re-packed (not `props` directly) so react/no-unused-prop-types can see each field is used.
  const state = getPreviewState({ isLoading, error, isPreviewUnavailable, result });

  switch (state.kind) {
    case 'loading':
      return (
        <Stack direction="row" gap={1} alignItems="center">
          <Spinner size="sm" />
          <Text color="secondary">
            <Trans i18nKey="alerting.settings.import.promote.checking">Checking promotion impact…</Trans>
          </Text>
        </Stack>
      );

    case 'unavailable':
      return (
        <Alert
          severity="info"
          title={t(
            'alerting.settings.import.promote.dry-run-unavailable-title',
            "Couldn't preview the promotion impact"
          )}
        >
          <Trans i18nKey="alerting.settings.import.promote.dry-run-unavailable-body">
            You can still promote — the merge itself is validated when you confirm.
          </Trans>
        </Alert>
      );

    case 'error':
      return (
        <Alert
          severity="error"
          title={t('alerting.settings.import.promote.dry-run-error', "Couldn't check the promotion impact")}
        >
          {state.message}
        </Alert>
      );

    case 'invalid':
      return (
        <Alert
          severity="error"
          title={t('alerting.settings.import.promote.invalid-title', "This configuration can't be promoted")}
        >
          {state.message}
        </Alert>
      );

    case 'valid':
      return (
        <StagedPromotePreview
          stats={state.result.stats}
          renamedReceivers={state.result.renamedReceivers}
          renamedTimeIntervals={state.result.renamedTimeIntervals}
        />
      );

    case 'idle':
      return null;
  }
}

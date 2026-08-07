import { Trans, t } from '@grafana/i18n';
import { Alert, ConfirmModal, Spinner, Stack, Text } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import { logError } from '../../Analytics';
import { convertToGMAApi } from '../../api/convertToGMAApi';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { stringifyErrorLike } from '../../utils/misc';

import { StagedPromotePreview } from './StagedPromotePreview';
import { type StagedExtraConfig } from './stagedConfig';
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
  const notifyApp = useAppNotification();
  const { result, isLoading, error } = useStagedConfigDryRun(stagedConfig);
  const [promote, { isLoading: isPromoting }] = convertToGMAApi.usePromoteAlertmanagerConfigMutation();

  // Only allow promoting once the dry-run confirms the merge is valid.
  const canPromote = Boolean(result?.valid) && !isLoading && !error && !isPromoting;

  // Merging into the live config can't be undone, so a second submit must not merge twice.
  const onConfirm = useSingleFlight(async () => {
    try {
      await promote({ configIdentifier: stagedConfig.identifier }).unwrap();
      notifyApp.success(
        t('alerting.settings.import.promote.success-title', 'Configuration promoted'),
        t('alerting.settings.import.promote.success-body', 'The imported resources were merged into your live config.')
      );
      onDismiss();
    } catch (err) {
      logError(new Error(stringifyErrorLike(err)));
      notifyApp.error(
        t('alerting.settings.import.promote.error-title', 'Failed to promote configuration'),
        stringifyErrorLike(err)
      );
    }
  });

  return (
    <ConfirmModal
      isOpen
      title={t('alerting.settings.import.promote.title', 'Promote this configuration?')}
      confirmText={t('alerting.settings.import.promote.confirm', 'Promote to live config')}
      confirmVariant="primary"
      disabled={!canPromote}
      onConfirm={onConfirm}
      // Prevent dismissing mid-promote so the mutation can't be interrupted.
      onDismiss={isPromoting ? () => {} : onDismiss}
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
                Once merged, the resources become normal Grafana resources and stop tracking the datasource. Grafana
                will not sync from it again.
              </Trans>
            </Alert>
          )}

          {isLoading && (
            <Stack direction="row" gap={1} alignItems="center">
              <Spinner size="sm" />
              <Text color="secondary">
                <Trans i18nKey="alerting.settings.import.promote.checking">Checking promotion impact…</Trans>
              </Text>
            </Stack>
          )}

          {!isLoading && error && (
            <Alert
              severity="error"
              title={t('alerting.settings.import.promote.dry-run-error', "Couldn't check the promotion impact")}
            >
              {error}
            </Alert>
          )}

          {!isLoading && !error && result && !result.valid && (
            <Alert
              severity="error"
              title={t('alerting.settings.import.promote.invalid-title', "This configuration can't be promoted")}
            >
              {result.error}
            </Alert>
          )}

          {!isLoading && !error && result?.valid && (
            <StagedPromotePreview
              stats={result.stats}
              renamedReceivers={result.renamedReceivers}
              renamedTimeIntervals={result.renamedTimeIntervals}
            />
          )}
        </Stack>
      }
    />
  );
}

import { generatedAPI as notificationsAPI } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { Trans, t } from '@grafana/i18n';
import { Alert, ConfirmModal, Spinner, Stack, Text } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useDispatch } from 'app/types/store';

import { logError } from '../../Analytics';
import { alertmanagerApi } from '../../api/alertmanagerApi';
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
  const dispatch = useDispatch();
  const { result, isLoading, error } = useStagedConfigDryRun(stagedConfig);
  const [promote, { isLoading: isPromoting }] = convertToGMAApi.usePromoteAlertmanagerConfigMutation();
  const [updateAlertingConfiguration, { isLoading: isClearingAutoSync }] =
    alertmanagerApi.endpoints.updateGrafanaAlertingConfiguration.useMutation();

  const isSubmitting = isPromoting || isClearingAutoSync;
  // Only allow promoting once the dry-run confirms the merge is valid.
  const canPromote = Boolean(result?.valid) && !isLoading && !error && !isSubmitting;

  /**
   * The sync worker stops on its own once it sees the merge committed, but the configured datasource
   * UID stays on the org config — which keeps auto-sync reported as active and keeps the convert API
   * rejecting notification imports. Clearing it is what actually ends the sync.
   *
   * Reports failure rather than throwing: it runs after an irreversible merge, so it must not be
   * mistaken for a failed promote.
   */
  const clearAutoSync = async (): Promise<boolean> => {
    try {
      await updateAlertingConfiguration({
        // Backend convention: empty string clears the configured UID.
        external_alertmanager_uid: '',
        notificationOptions: { showErrorAlert: false },
      }).unwrap();
      // The UID lives in a different RTKQ slice than the Config resource useIsAutoSyncActive reads,
      // so tag invalidation doesn't cross over on its own.
      dispatch(notificationsAPI.util.invalidateTags(['Config']));
      return true;
    } catch (err) {
      logError(new Error(stringifyErrorLike(err)));
      return false;
    }
  };

  // Merging into the live config can't be undone, so a second submit must not merge twice.
  const onConfirm = useSingleFlight(async () => {
    try {
      await promote({ configIdentifier: stagedConfig.identifier }).unwrap();
    } catch (err) {
      logError(new Error(stringifyErrorLike(err)));
      notifyApp.error(
        t('alerting.settings.import.promote.error-title', 'Failed to promote configuration'),
        stringifyErrorLike(err)
      );
      return;
    }

    // The merge has landed by this point, so nothing below may report the promote as failed.
    if (isSyncManaged && !(await clearAutoSync())) {
      notifyApp.warning(
        t(
          'alerting.settings.import.promote.sync-not-cleared-title',
          'Configuration promoted, but auto-sync is still configured'
        ),
        t(
          'alerting.settings.import.promote.sync-not-cleared-body',
          'Nothing syncs from the datasource any more. Disable auto-sync in Alerting settings to import notification resources again — if it is set in grafana.ini, remove the key there.'
        )
      );
    } else {
      notifyApp.success(
        t('alerting.settings.import.promote.success-title', 'Configuration promoted'),
        t('alerting.settings.import.promote.success-body', 'The imported resources were merged into your live config.')
      );
    }
    onDismiss();
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

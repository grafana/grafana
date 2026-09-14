import { t } from '@grafana/i18n';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useDispatch } from 'app/types/store';

import { logError } from '../../Analytics';
import { ALERTMANAGER_PROVIDED_ENTITY_TAGS, alertmanagerApi } from '../../api/alertmanagerApi';
import { CONFIG_SINGLETON_NAME, configApi, useAutoSyncConfigQuery } from '../../api/configApi';
import { convertToGMAApi } from '../../api/convertToGMAApi';
import { deriveSyncSource } from '../../utils/autoSync';
import { stringifyErrorLike } from '../../utils/misc';

import { type StagedExtraConfig } from './stagedConfig';

interface UsePromoteStagedConfigResult {
  onConfirm: () => Promise<void>;
  isSubmitting: boolean;
}

/** Distinguishes *why* auto-sync isn't cleanly off after a promote, since each cause needs different copy. */
type PromoteSyncOutcome = 'cleared' | 'not-cleared' | 'ini-managed';

/**
 * Promotes a staged Alertmanager config into the live one, then — for auto-sync-managed configs —
 * clears the configured auto-sync datasource UID so the merge doesn't keep getting treated as
 * sync-managed. Reports the outcome via app notifications and calls `onDismiss` once it settles.
 */
export function usePromoteStagedConfig(
  stagedConfig: StagedExtraConfig,
  isSyncManaged: boolean | undefined,
  onDismiss: () => void
): UsePromoteStagedConfigResult {
  const notifyApp = useAppNotification();
  const dispatch = useDispatch();
  const [promote, { isLoading: isPromoting }] = convertToGMAApi.usePromoteAlertmanagerConfigMutation();
  const [updateConfig, { isLoading: isClearingAutoSync }] = configApi.useUpdateConfigMutation();
  const { currentData: configResource } = useAutoSyncConfigQuery();

  const isSubmitting = isPromoting || isClearingAutoSync;

  /**
   * The sync worker stops on its own once it sees the merge committed, but the configured datasource
   * UID stays on the org Config — which keeps auto-sync reported as active and keeps the convert API
   * rejecting notification imports. Clearing it is what actually ends the sync — except for an
   * ini-managed org, where spec is dormant and this clear can never stop it (see `resolveSyncOutcome`).
   *
   * Reports failure rather than throwing: it runs after an irreversible merge, so it must not be
   * mistaken for a failed promote.
   */
  const clearAutoSync = async (): Promise<boolean> => {
    try {
      await updateConfig({
        name: CONFIG_SINGLETON_NAME,
        patch: [{ op: 'add', path: '/spec/externalAlertmanagerSync', value: {} }],
      }).unwrap();
      // updateConfig only invalidates 'Config', in a different RTKQ slice than alertmanagerApi;
      // clearing sync rewrites the Alertmanager entities the worker had been importing.
      dispatch(alertmanagerApi.util.invalidateTags([...ALERTMANAGER_PROVIDED_ENTITY_TAGS]));
      return true;
    } catch (err) {
      logError(new Error(stringifyErrorLike(err)));
      return false;
    }
  };

  // Clearing the spec never stops an ini-managed sync — spec is dormant there — so a successful
  // clear isn't enough on its own to call auto-sync off; deriveSyncSource's status read is.
  const resolveSyncOutcome = async (): Promise<PromoteSyncOutcome> => {
    if (!(await clearAutoSync())) {
      return 'not-cleared';
    }
    return deriveSyncSource(configResource).isIniManaged ? 'ini-managed' : 'cleared';
  };

  const reportSyncOutcome = (outcome: PromoteSyncOutcome) => {
    if (outcome === 'cleared') {
      notifyApp.success(
        t('alerting.settings.import.promote.success-title', 'Configuration promoted'),
        t('alerting.settings.import.promote.success-body', 'The imported resources were merged into your live config.')
      );
      return;
    }
    if (outcome === 'not-cleared') {
      notifyApp.warning(
        t(
          'alerting.settings.import.promote.sync-not-cleared-title',
          'Configuration promoted, but auto-sync is still configured'
        ),
        t(
          'alerting.settings.import.promote.sync-not-cleared-body',
          'The auto-sync setting could not be cleared. Disable auto-sync in Alerting settings to import notification resources again.'
        )
      );
      return;
    }
    notifyApp.warning(
      t(
        'alerting.settings.import.promote.sync-ini-managed-title',
        'Configuration promoted, but auto-sync is still active'
      ),
      t(
        'alerting.settings.import.promote.sync-ini-managed-body',
        'Grafana keeps syncing from the datasource set in grafana.ini. Remove that key to stop the sync and import notification resources again.'
      )
    );
  };

  const onConfirm = async () => {
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
    reportSyncOutcome(isSyncManaged ? await resolveSyncOutcome() : 'cleared');
    onDismiss();
  };

  return { onConfirm, isSubmitting };
}

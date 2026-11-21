import { isEmpty } from 'lodash';
import { useCallback, useState } from 'react';

import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useAppNotification } from 'app/core/copy/appNotification';
import { type RulerCloudRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { trackImportToGMAError, trackImportToGMASuccess } from '../../Analytics';
import { ALERTING_IMPORT_SETTINGS_URL } from '../../settings/navigation';
import { type Folder } from '../../types/rule-form';
import { stringifyErrorLike } from '../../utils/misc';
import { createListFilterLink } from '../../utils/navigation';
import { useAutoSyncConfiguration } from '../settings/useAutoSyncConfiguration';

import { type NotificationsLock } from './LockNotices';
import { type ImportPlan, getImportPlan } from './Wizard/steps';
import { buildRulesImportJob } from './steps/utils';
import { type ImportFormValues } from './types';
import { buildRoutingParams, useImportNotifications, useImportRules } from './useImport';

type ImportStatus = 'idle' | 'importing' | 'success' | 'error' | 'partial-error';

interface PostImportOutcome {
  title: string;
  body?: string;
  redirectTo: string;
}

/** What to tell the user, and where to send them, once an import has gone through. */
export function getPostImportOutcome(plan: ImportPlan, targetFolder: Folder | undefined): PostImportOutcome {
  if (plan.willEnableAutoSync) {
    const body = t(
      'alerting.wizard-import-to-gma.autosync-success-body',
      'Grafana will keep syncing alert configuration from this data source.'
    );
    return {
      title: t('alerting.wizard-import-to-gma.autosync-success-title', 'Auto-sync enabled'),
      body: plan.willImportRules
        ? `${body} ${t('alerting.wizard-import-to-gma.autosync-rules-imported-note', 'Your alert rules were also imported.')}`
        : body,
      redirectTo: ALERTING_IMPORT_SETTINGS_URL,
    };
  }
  if (plan.willImportNotifications) {
    // A staged notifications import lands on the Import tab so the user can review the staged
    // copy and decide to promote or revert it. Everything else keeps the rule-list redirect.
    return {
      title: t('alerting.wizard-import-to-gma.staged-success-title', 'Configuration staged'),
      body: t(
        'alerting.wizard-import-to-gma.staged-success-body',
        'Your imported config is now staged in the Import tab.'
      ),
      redirectTo: ALERTING_IMPORT_SETTINGS_URL,
    };
  }
  return {
    title: t('alerting.wizard-import-to-gma.success', 'Successfully imported resources to Grafana Alerting.'),
    redirectTo: createListFilterLink(isEmpty(targetFolder?.uid) ? [] : [['namespace', targetFolder?.title ?? '']], {
      skipSubPath: true,
    }),
  };
}

interface UseImportJobArgs {
  getImportValues: () => ImportFormValues;
  /** The rules to send: the ones of the data source after the namespace and group filter, or the ones in the file. */
  rulesToImport: RulerCloudRulesConfigDTO | undefined;
  liveNotificationsLock: NotificationsLock | undefined;
}

export function useImportJob({ getImportValues, rulesToImport, liveNotificationsLock }: UseImportJobArgs) {
  const importNotifications = useImportNotifications();
  const importRules = useImportRules();
  const { save: saveAutoSync } = useAutoSyncConfiguration();
  const notifyApp = useAppNotification();

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  // What the failed request reported, shown in the confirm modal.
  const [importError, setImportError] = useState<string>();

  // An import can turn sync on, which locks the notifications step. Keep the lock the import started with
  // until it is done, so the step isn't swapped out from under it.
  const [lockAtImport, setLockAtImport] = useState(liveNotificationsLock);
  const notificationsLock = importStatus === 'idle' ? liveNotificationsLock : lockAtImport;

  const [outcome, setOutcome] = useState<PostImportOutcome>();

  const startImport = useCallback(() => {
    setShowConfirmModal(true);
  }, []);

  const confirmImport = useCallback(async () => {
    setLockAtImport(liveNotificationsLock);
    setImportStatus('importing');
    setImportError(undefined);

    const values = getImportValues();
    const plan = getImportPlan(values);
    const rulesJob = buildRulesImportJob(values);
    const trackedNotificationsSource =
      plan.willEnableAutoSync || plan.willImportNotifications ? values.notificationsSource : undefined;
    const trackedRulesSource = plan.willImportRules ? rulesJob?.type : undefined;

    try {
      // Mutually exclusive: Auto-sync only applies to the datasource source, so at most one of
      // these branches runs.
      if (plan.willEnableAutoSync) {
        const enabled = await saveAutoSync(values.notificationsDatasourceUID, { silent: true });
        if (!enabled) {
          setImportStatus('error');
          trackImportToGMAError({ notificationsSource: trackedNotificationsSource });
          return;
        }
      } else if (plan.willImportNotifications) {
        await importNotifications({
          source: values.notificationsSource,
          datasourceName: values.notificationsDatasourceName ?? undefined,
          yamlFile: values.notificationsYamlFile,
          templateFiles: values.notificationsTemplateFiles,
          configIdentifier: values.policyTreeName,
          promote: false,
        });
      }

      // Independent of Auto-sync, which only mirrors Alertmanager config, never rules.
      if (plan.willImportRules && rulesJob?.datasource) {
        const baseParams = {
          dataSourceUID: rulesJob.datasource.uid,
          targetFolderUID: rulesJob.targetFolder?.uid,
          pauseAlertingRules: rulesJob.pauseAlertingRules,
          pauseRecordingRules: rulesJob.pauseRecordingRules,
          payload: rulesToImport ?? {},
          targetDatasourceUID: rulesJob.targetDatasourceUID,
        };

        const { notificationSettings } = buildRoutingParams(rulesJob.selectedRoutingTree);
        await importRules({ ...baseParams, notificationSettings });
      }

      setOutcome(getPostImportOutcome(plan, values.targetFolder));
      setImportStatus('success');

      trackImportToGMASuccess({
        notificationsSource: trackedNotificationsSource,
        rulesSource: trackedRulesSource,
        isRootFolder: isEmpty(values.targetFolder?.uid),
        namespace: values.namespace,
        ruleGroup: values.ruleGroup,
        pauseRecordingRules: values.pauseRecordingRules,
        pauseAlertingRules: values.pauseAlertingRules,
      });
    } catch (err) {
      // saveAutoSync resolves to false instead of throwing, so getting here with willEnableAutoSync means
      // sync was already turned on and the rules import after it failed. The copy must not say sync failed.
      setImportStatus(plan.willEnableAutoSync ? 'partial-error' : 'error');
      trackImportToGMAError({ notificationsSource: trackedNotificationsSource, rulesSource: trackedRulesSource });
      setImportError(stringifyErrorLike(err));
    }
  }, [getImportValues, importNotifications, importRules, rulesToImport, saveAutoSync, liveNotificationsLock]);

  // Leaving the success state, by button, Escape or the close icon, is what takes the user on to the result.
  const closeConfirm = useCallback(() => {
    if (importStatus === 'success' && outcome) {
      setShowConfirmModal(false);
      // The Import tab hosts this wizard, so redirecting there doesn't unmount it. Go back to idle so the
      // lock catches up with what the import did and the modal reopens on the confirmation.
      setImportStatus('idle');
      notifyApp.success(outcome.title, outcome.body);
      locationService.push(outcome.redirectTo);
    } else if (importStatus !== 'importing') {
      setShowConfirmModal(false);
      setImportStatus('idle');
    }
  }, [importStatus, outcome, notifyApp]);

  return {
    notificationsLock,
    showConfirmModal,
    importStatus,
    importError,
    startImport,
    confirmImport,
    closeConfirm,
  };
}

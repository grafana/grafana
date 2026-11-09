import { useCallback, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';

import { isDefaultRoutingTreeName } from '@grafana/alerting/unstable';
import { generatedAPI as routingTreeApi } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { t } from '@grafana/i18n';

import { type PredictedSyncIdentifier } from '../../../utils/autoSync';
import { useAutoSyncConfiguration } from '../../settings/useAutoSyncConfiguration';
import { isAutoSyncSelected } from '../Wizard/steps';
import { type ImportFormValues } from '../types';

import { useAutoSyncPrediction } from './useAutoSyncPrediction';
import { findDuplicateTemplateFileName, validatePolicyTreeName } from './utils';

function getAutoSyncConflictMessage(prediction: PredictedSyncIdentifier | undefined): string | undefined {
  if (prediction?.conflict === 'policy-tree') {
    return t(
      'alerting.import-to-gma.step1.autosync-name-taken',
      'The sync would use the name {{name}}, which a policy tree already uses. Rename the data source or the policy tree.',
      { name: prediction.identifier }
    );
  }
  if (prediction?.conflict === 'reserved') {
    return t(
      'alerting.import-to-gma.step1.autosync-name-reserved',
      'The sync would use the name {{name}}, which is reserved for the default policy. Rename the data source.',
      { name: prediction.identifier }
    );
  }
  return undefined;
}

/** What Step 1's fields need to know about Auto-sync, the policy tree name and the template files. */
export function useStep1Form() {
  const { watch, setValue, trigger, clearErrors } = useFormContext<ImportFormValues>();
  const [getRoutingTree] = routingTreeApi.useLazyGetRoutingTreeQuery();

  const [
    notificationsSource,
    notificationsDatasourceUID,
    notificationsTemplateFiles,
    autoSyncNotificationsEnabled,
    notificationsDatasourceName,
  ] = watch([
    'notificationsSource',
    'notificationsDatasourceUID',
    'notificationsTemplateFiles',
    'autoSyncNotificationsEnabled',
    'notificationsDatasourceName',
  ]);

  // Auto-sync mirrors the source directly and names the policy tree itself, so the name field is off.
  const autoSyncActive = isAutoSyncSelected(autoSyncNotificationsEnabled ?? false, notificationsSource);

  // Called unconditionally (even for the YAML source) so the Auto-sync checkbox always knows
  // whether the selected datasource qualifies; its own queries stay skipped for non-admins/toggle-off.
  const {
    autoSyncEligibleAlertmanagers,
    isLoading: isLoadingAutoSyncConfig,
    isReady: isAutoSyncConfigReady,
    notReadyMessage: autoSyncNotReadyMessage,
  } = useAutoSyncConfiguration();
  const isSelectedDatasourceAutoSyncCapable =
    !isLoadingAutoSyncConfig && autoSyncEligibleAlertmanagers.some((ds) => ds.uid === notificationsDatasourceUID);

  const duplicateTemplateFileName = findDuplicateTemplateFileName(notificationsTemplateFiles);

  // The disabled name field shows this name in its tooltip, and the conflict message when it is taken.
  const autoSyncPrediction = useAutoSyncPrediction(
    autoSyncActive,
    notificationsDatasourceUID,
    notificationsDatasourceName
  );

  // Checks the name's format, then asks whether a policy tree already has it.
  const validatePolicyTreeNameIsFree = useCallback(
    async (value: string): Promise<string | true> => {
      const formatResult = validatePolicyTreeName(value);
      if (formatResult !== true) {
        return formatResult;
      }
      if (isDefaultRoutingTreeName(value)) {
        return t('alerting.import-to-gma.step1.policy-tree-reserved', 'This name is reserved for the default policy');
      }
      const { data } = await getRoutingTree({ name: value }, true);
      if (data) {
        return t('alerting.import-to-gma.step1.policy-tree-taken', 'A policy tree with this name already exists');
      }
      // Not found means the name is free. If the lookup failed for another reason, the import itself still
      // rejects a name that is taken, so don't block the user here.
      return true;
    },
    [getRoutingTree]
  );

  // Drop any leftover Policy Tree Name error once Auto-sync disables the field.
  useEffect(() => {
    if (autoSyncActive) {
      clearErrors('policyTreeName');
    }
  }, [autoSyncActive, clearErrors]);

  // Don't leave a stale checked Auto-sync flag pointing at a datasource that doesn't support it.
  // Skip while loading so a legitimately-checked, still-valid selection isn't cleared against the
  // momentarily-empty Mimir/Cortex list.
  useEffect(() => {
    if (!isLoadingAutoSyncConfig && !isSelectedDatasourceAutoSyncCapable && autoSyncNotificationsEnabled) {
      setValue('autoSyncNotificationsEnabled', false);
    }
  }, [isLoadingAutoSyncConfig, isSelectedDatasourceAutoSyncCapable, autoSyncNotificationsEnabled, setValue]);

  const handlePolicyTreeNameBlur = useCallback(async () => {
    await trigger('policyTreeName');
  }, [trigger]);

  return {
    autoSyncActive,
    autoSyncEligibleAlertmanagers,
    isAutoSyncConfigReady,
    autoSyncNotReadyMessage,
    isSelectedDatasourceAutoSyncCapable,
    autoSyncIdentifier: autoSyncPrediction?.identifier,
    autoSyncConflictMessage: getAutoSyncConflictMessage(autoSyncPrediction),
    duplicateTemplateFileName,
    validatePolicyTreeNameIsFree,
    handlePolicyTreeNameBlur,
  };
}

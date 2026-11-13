import { skipToken } from '@reduxjs/toolkit/query/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type UseFormReturn } from 'react-hook-form';
import { useDebounce } from 'react-use';

import {
  trackImportToGMADryrunError,
  trackImportToGMADryrunSuccess,
  trackImportToGMADryrunWarning,
} from '../../Analytics';
import { type ValidateAlertmanagerConfigImportArgs, convertApi } from '../../api/convertToGMAApi';
import { stringifyErrorLike } from '../../utils/misc';

import { useStepperState } from './Wizard/StepperState';
import { isAutoSyncSelected } from './Wizard/steps';
import { StepKey } from './Wizard/types';
import { usePredictedAutoSyncIdentifier } from './steps/Step1AlertmanagerResources';
import { buildDryRunArgs } from './steps/utils';
import { type ImportFormValues, type Step1Values } from './types';
import { deriveDryRunResult, deriveDryRunState, parseDryRunResponse } from './useImport';

/**
 * Step 1's dry run: a debounced live preview of the configuration being entered, and the fresh check that
 * Next runs before moving on.
 */
export function useStep1DryRun({ watch, getValues }: UseFormReturn<ImportFormValues>) {
  const { setStepErrors } = useStepperState();

  const [
    notificationsSource,
    policyTreeName,
    notificationsDatasourceUID,
    notificationsDatasourceName,
    notificationsYamlFile,
    notificationsTemplateFiles,
    autoSyncNotificationsEnabled,
  ] = watch([
    'notificationsSource',
    'policyTreeName',
    'notificationsDatasourceUID',
    'notificationsDatasourceName',
    'notificationsYamlFile',
    'notificationsTemplateFiles',
    'autoSyncNotificationsEnabled',
  ]);

  const liveStep1Values: Step1Values = useMemo(
    () => ({
      notificationsSource,
      policyTreeName,
      notificationsDatasourceUID,
      notificationsDatasourceName,
      notificationsYamlFile,
      notificationsTemplateFiles,
      autoSyncNotificationsEnabled,
    }),
    [
      notificationsSource,
      policyTreeName,
      notificationsDatasourceUID,
      notificationsDatasourceName,
      notificationsYamlFile,
      notificationsTemplateFiles,
      autoSyncNotificationsEnabled,
    ]
  );
  // Auto-sync names the policy tree itself, so its dry run checks under the name the sync will pick.
  const autoSyncIdentifier = usePredictedAutoSyncIdentifier(
    isAutoSyncSelected(autoSyncNotificationsEnabled ?? false, notificationsSource),
    notificationsDatasourceUID,
    notificationsDatasourceName
  );
  // The step 1 values without the policy tree name. The dry run is rebuilt from these, so typing a name
  // doesn't rerun it; the name it sends along is read when the configuration changes.
  const liveConfigValues = useMemo(
    () => ({
      notificationsSource,
      notificationsDatasourceUID,
      notificationsDatasourceName,
      notificationsYamlFile,
      notificationsTemplateFiles,
      autoSyncNotificationsEnabled,
    }),
    [
      notificationsSource,
      notificationsDatasourceUID,
      notificationsDatasourceName,
      notificationsYamlFile,
      notificationsTemplateFiles,
      autoSyncNotificationsEnabled,
    ]
  );
  const liveDryRunArgs = useMemo(
    () => buildDryRunArgs({ ...liveConfigValues, policyTreeName: getValues('policyTreeName') }, autoSyncIdentifier),
    [liveConfigValues, autoSyncIdentifier, getValues]
  );

  // Early feedback only: it never gates Next, which runs checkNow, so lagging the live inputs is fine.
  const [dryRunArgs, setDryRunArgs] = useState<ValidateAlertmanagerConfigImportArgs | typeof skipToken>(skipToken);
  useDebounce(() => setDryRunArgs(liveDryRunArgs), 500, [liveDryRunArgs]);

  const {
    currentData: dryRunRawData,
    isFetching: isDryRunFetching,
    error: dryRunRawError,
  } = convertApi.useValidateAlertmanagerConfigImportQuery(dryRunArgs);

  const dryRunParsedResult = useMemo(
    () => (dryRunRawData ? parseDryRunResponse(dryRunRawData) : undefined),
    [dryRunRawData]
  );
  const dryRunErrorMessage = dryRunRawError ? stringifyErrorLike(dryRunRawError) : undefined;
  const dryRunResult = useMemo(
    () => deriveDryRunResult(dryRunParsedResult, dryRunErrorMessage),
    [dryRunParsedResult, dryRunErrorMessage]
  );
  const dryRunState = useMemo(
    () => deriveDryRunState(isDryRunFetching, dryRunResult, dryRunErrorMessage),
    [isDryRunFetching, dryRunResult, dryRunErrorMessage]
  );

  useEffect(() => {
    if (dryRunState === 'error') {
      setStepErrors(StepKey.Notifications, true);
    } else if (dryRunState === 'success' || dryRunState === 'warning') {
      setStepErrors(StepKey.Notifications, false);
    }
  }, [dryRunState, setStepErrors]);

  const [triggerDryRunCheck] = convertApi.useLazyValidateAlertmanagerConfigImportQuery();
  const [isChecking, setIsChecking] = useState(false);

  // A fresh, awaited check instead of the debounced preview, which lags the live inputs by design.
  // Resolves to whether the step may go on.
  const checkNow = useCallback(
    async (snapshot: Step1Values): Promise<boolean> => {
      const args = buildDryRunArgs(snapshot, autoSyncIdentifier);
      if (args === skipToken) {
        return true;
      }
      // Keep the preview in sync with what we're about to check, instead of waiting on the debounce.
      setDryRunArgs(args);
      setIsChecking(true);
      try {
        const result = parseDryRunResponse(await triggerDryRunCheck(args).unwrap());
        const state = deriveDryRunState(false, result, undefined);
        if (state === 'warning') {
          trackImportToGMADryrunWarning({
            renamedReceiversCount: result.renamedReceivers.length,
            renamedTimeIntervalsCount: result.renamedTimeIntervals.length,
          });
        } else if (state === 'success') {
          trackImportToGMADryrunSuccess();
        } else {
          trackImportToGMADryrunError();
          return false;
        }
      } catch {
        trackImportToGMADryrunError();
        return false;
      } finally {
        setIsChecking(false);
      }
      return true;
    },
    [triggerDryRunCheck, autoSyncIdentifier]
  );

  return { liveStep1Values, autoSyncIdentifier, dryRunResult, dryRunState, isChecking, checkNow };
}

export type Step1DryRun = ReturnType<typeof useStep1DryRun>;

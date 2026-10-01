import { useEffect, useMemo, useRef } from 'react';

import { getStatusFromError } from 'app/core/utils/errors';

import { convertToGMAApi } from '../../api/convertToGMAApi';
import { type DryRunValidationResult } from '../../components/import-to-gma/types';
import { parseDryRunResponse } from '../../components/import-to-gma/useImport';
import { stringifyErrorLike } from '../../utils/misc';

import { type StagedExtraConfig } from './stagedConfig';

interface StagedConfigDryRun {
  result?: DryRunValidationResult;
  isLoading: boolean;
  error?: string;
  /** Whether the preview failed for a reason that doesn't reflect promote eligibility. */
  isPreviewUnavailable: boolean;
}

/**
 * Dry-runs a promote of the already-staged Alertmanager config to build the impact preview shown in
 * the promote modal. Reuses the staged YAML + templates (no datasource/file resolution needed), so we
 * call the dry-run mutation directly rather than the wizard's useDryRunNotifications.
 */
export function useStagedConfigDryRun(stagedConfig: StagedExtraConfig): StagedConfigDryRun {
  const [dryRun, { data, isLoading, error }] = convertToGMAApi.useDryRunAlertmanagerConfigMutation();

  // Captures stagedConfig at mount so a parent passing a new-but-equivalent object on a later
  // render doesn't re-fire the dry-run.
  const configRef = useRef(stagedConfig);
  useEffect(() => {
    const config = configRef.current;
    dryRun({
      alertmanagerConfig: config.alertmanager_config ?? '',
      templateFiles: config.template_files,
      configIdentifier: config.identifier,
      promote: true,
      // PromoteConfirmModal already renders an inline banner for every failure mode
      // so a global toast would duplicate or contradict it.
      notificationOptions: { showErrorAlert: false },
    });
  }, [dryRun]);

  const result = useMemo(() => (data ? parseDryRunResponse(data) : undefined), [data]);

  // The preview enforces backend checks (a sync gate, a stricter permission check) that promote
  // itself doesn't apply, so a 403/409 here doesn't mean promote will fail.
  const status = getStatusFromError(error);
  const isPreviewUnavailable = status === 403 || status === 409;

  return {
    result,
    isLoading,
    error: error ? stringifyErrorLike(error) : undefined,
    isPreviewUnavailable,
  };
}

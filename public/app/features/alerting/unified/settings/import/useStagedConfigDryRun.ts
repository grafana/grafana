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

  // A staged config is immutable for a given identifier and the modal mounts fresh each time it opens,
  // so we capture the config at mount and dry-run once. This avoids re-firing if a parent ever passes a
  // new stagedConfig reference (e.g. a fresh template_files object) for the same underlying config.
  const configRef = useRef(stagedConfig);
  useEffect(() => {
    const config = configRef.current;
    dryRun({
      alertmanagerConfig: config.alertmanager_config ?? '',
      templateFiles: config.template_files,
      configIdentifier: config.identifier,
      promote: true,
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

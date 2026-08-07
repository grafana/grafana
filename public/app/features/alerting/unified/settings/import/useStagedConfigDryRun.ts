import { useEffect, useMemo, useRef } from 'react';

import { convertToGMAApi } from '../../api/convertToGMAApi';
import { type DryRunValidationResult } from '../../components/import-to-gma/types';
import { parseDryRunResponse } from '../../components/import-to-gma/useImport';
import { stringifyErrorLike } from '../../utils/misc';

import { type StagedExtraConfig } from './stagedConfig';

interface StagedConfigDryRun {
  result?: DryRunValidationResult;
  isLoading: boolean;
  error?: string;
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

  return { result, isLoading, error: error ? stringifyErrorLike(error) : undefined };
}

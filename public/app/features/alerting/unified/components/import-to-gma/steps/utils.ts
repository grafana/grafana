/**
 * Shared validation utilities for import-to-gma steps
 */
import { skipToken } from '@reduxjs/toolkit/query/react';

import { type ValidateAlertmanagerConfigImportArgs } from '../../../api/convertToGMAApi';
import { isAutoSyncSelected } from '../Wizard/steps';
import { type ImportFormValues, type Step1Values } from '../types';

/** RFC 1123 subdomain pattern — must match the backend's identifier validation */
const POLICY_TREE_NAME_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

/** Maximum length for a policy tree name, enforced by the backend (k8s DNS-1123 subdomain) */
const POLICY_TREE_NAME_MAX_LENGTH = 40;

/**
 * Validates a policy tree name against RFC 1123 subdomain rules.
 * Returns an error message string if invalid, or `true` if valid.
 * Compatible with react-hook-form's `validate` option.
 */
export function validatePolicyTreeName(value: string): string | true {
  if (value.length > POLICY_TREE_NAME_MAX_LENGTH) {
    return `Must be at most ${POLICY_TREE_NAME_MAX_LENGTH} characters`;
  }
  if (!POLICY_TREE_NAME_PATTERN.test(value)) {
    return 'Must be lowercase alphanumeric, dashes or dots, and start/end with an alphanumeric character (e.g. "prometheus-prod")';
  }
  return true;
}

/**
 * Validates that a source selection has the required data based on the source type
 */
export function hasValidSourceSelection(
  source: 'yaml' | 'datasource',
  yamlFile: File | null | undefined,
  datasourceUID: string | null | undefined
): boolean {
  if (source === 'yaml' && !yamlFile) {
    return false;
  }
  if (source === 'datasource' && !datasourceUID) {
    return false;
  }
  return true;
}

/**
 * Returns the first template file name that occurs more than once, or undefined if all names are unique.
 * Template files are keyed by file name when combined into the convert payload, so duplicate names are
 * ambiguous and must be rejected.
 */
export function findDuplicateTemplateFileName(files: File[] = []): string | undefined {
  const seen = new Set<string>();
  for (const file of files) {
    if (seen.has(file.name)) {
      return file.name;
    }
    seen.add(file.name);
  }
  return undefined;
}

export interface Step1ValidationParams {
  policyTreeName: string | null;
  notificationsSource: 'yaml' | 'datasource';
  notificationsYamlFile: File | null;
  notificationsDatasourceUID: string | null | undefined;
  notificationsTemplateFiles: File[];
  autoSyncNotificationsEnabled: boolean;
}

/**
 * Validates that Step 1 form is complete and valid. When Auto-sync is selected, only a data
 * source is required — there's no staged config to name or dry-run.
 */
export function isStep1Valid(params: Step1ValidationParams): boolean {
  const {
    policyTreeName,
    notificationsSource,
    notificationsYamlFile,
    notificationsDatasourceUID,
    notificationsTemplateFiles,
    autoSyncNotificationsEnabled,
  } = params;

  if (isAutoSyncSelected(autoSyncNotificationsEnabled, notificationsSource)) {
    return Boolean(notificationsDatasourceUID);
  }

  if (!policyTreeName || validatePolicyTreeName(policyTreeName) !== true) {
    return false;
  }
  if (findDuplicateTemplateFileName(notificationsTemplateFiles)) {
    return false;
  }
  return hasValidSourceSelection(notificationsSource, notificationsYamlFile, notificationsDatasourceUID);
}

/**
 * Auto-sync always returns false here, unlike isStep1Valid — it has no staged config to
 * validate, even though a selected Auto-sync datasource is sufficient for isStep1Valid.
 */
export function canRunDryRun(params: Step1ValidationParams): boolean {
  if (isAutoSyncSelected(params.autoSyncNotificationsEnabled, params.notificationsSource)) {
    return false;
  }
  return isStep1Valid({ ...params, autoSyncNotificationsEnabled: false });
}

export interface Step2ValidationParams {
  rulesSource: 'yaml' | 'datasource';
  rulesYamlFile: File | null;
  rulesDatasourceUID: string | null | undefined;
  /** Selected routing tree name */
  selectedRoutingTree: string;
  targetDatasourceUID: string | null | undefined;
}

/**
 * Validates that Step 2 form is complete and valid
 */
export function isStep2Valid(params: Step2ValidationParams): boolean {
  const { rulesSource, rulesYamlFile, rulesDatasourceUID, selectedRoutingTree, targetDatasourceUID } = params;

  if (!hasValidSourceSelection(rulesSource, rulesYamlFile, rulesDatasourceUID)) {
    return false;
  }
  if (!selectedRoutingTree) {
    return false;
  }
  if (!targetDatasourceUID) {
    return false;
  }
  return true;
}

export function pickStep1Values(values: ImportFormValues): Step1Values {
  return {
    policyTreeName: values.policyTreeName,
    notificationsSource: values.notificationsSource,
    notificationsDatasourceUID: values.notificationsDatasourceUID,
    notificationsDatasourceName: values.notificationsDatasourceName,
    notificationsYamlFile: values.notificationsYamlFile,
    notificationsTemplateFiles: values.notificationsTemplateFiles,
    autoSyncNotificationsEnabled: values.autoSyncNotificationsEnabled,
  };
}

/**
 * The dry run checks the configuration, so it can run as soon as there is one: a file was uploaded or a
 * datasource picked. A valid policy tree name is sent along when there is one, since contact points that
 * clash with existing ones are renamed after it. Auto-sync names the tree itself, so its dry run uses the
 * name the sync will pick, and waits until that is known.
 */
export function buildDryRunArgs(
  values: Step1Values,
  autoSyncIdentifier: string | undefined
): ValidateAlertmanagerConfigImportArgs | typeof skipToken {
  const autoSyncActive = isAutoSyncSelected(values.autoSyncNotificationsEnabled ?? false, values.notificationsSource);
  const hasSource =
    !findDuplicateTemplateFileName(values.notificationsTemplateFiles) &&
    hasValidSourceSelection(
      values.notificationsSource,
      values.notificationsYamlFile,
      values.notificationsDatasourceUID
    );
  if (!hasSource || (autoSyncActive && !autoSyncIdentifier)) {
    return skipToken;
  }
  let configIdentifier: string | undefined;
  if (autoSyncActive) {
    configIdentifier = autoSyncIdentifier;
  } else if (values.policyTreeName && validatePolicyTreeName(values.policyTreeName) === true) {
    configIdentifier = values.policyTreeName;
  }
  return {
    source: values.notificationsSource,
    yamlFile: values.notificationsYamlFile,
    templateFiles: values.notificationsTemplateFiles,
    datasourceName: values.notificationsDatasourceName ?? undefined,
    configIdentifier,
  };
}

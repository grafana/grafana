/**
 * Shared validation utilities for import-to-gma steps
 */

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

export interface Step1ValidationParams {
  canImport: boolean;
  policyTreeName: string | null;
  notificationsSource: 'yaml' | 'datasource';
  notificationsYamlFile: File | null;
  notificationsDatasourceUID: string | null | undefined;
}

/**
 * Validates that Step 1 form is complete and valid
 */
export function isStep1Valid(params: Step1ValidationParams): boolean {
  const { canImport, policyTreeName, notificationsSource, notificationsYamlFile, notificationsDatasourceUID } = params;

  if (!canImport || !policyTreeName) {
    return false;
  }
  return hasValidSourceSelection(notificationsSource, notificationsYamlFile, notificationsDatasourceUID);
}

export interface Step2ValidationParams {
  canImport: boolean;
  rulesSource: 'yaml' | 'datasource';
  rulesYamlFile: File | null;
  rulesDatasourceUID: string | null | undefined;
  notificationPolicyOption: 'imported' | 'default' | 'manual';
  manualLabelName: string | null;
  manualLabelValue: string | null;
  targetDatasourceUID: string | null | undefined;
}

/**
 * Validates that Step 2 form is complete and valid
 */
export function isStep2Valid(params: Step2ValidationParams): boolean {
  const {
    canImport,
    rulesSource,
    rulesYamlFile,
    rulesDatasourceUID,
    notificationPolicyOption,
    manualLabelName,
    manualLabelValue,
    targetDatasourceUID,
  } = params;

  if (!canImport) {
    return false;
  }
  if (!hasValidSourceSelection(rulesSource, rulesYamlFile, rulesDatasourceUID)) {
    return false;
  }
  if (notificationPolicyOption === 'manual' && (!manualLabelName || !manualLabelValue)) {
    return false;
  }
  if (!targetDatasourceUID) {
    return false;
  }
  return true;
}

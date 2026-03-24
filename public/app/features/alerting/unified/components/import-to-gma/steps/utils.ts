/**
 * Shared validation utilities for import-to-gma steps
 */

/** RFC 1123 subdomain pattern — must match the backend's identifier validation */
const POLICY_TREE_NAME_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

/** Maximum length for a policy tree name, enforced by the backend (k8s DNS-1123 subdomain) */
export const POLICY_TREE_NAME_MAX_LENGTH = 40;

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

export interface Step1ValidationParams {
  policyTreeName: string | null;
  notificationsSource: 'yaml' | 'datasource';
  notificationsYamlFile: File | null;
  notificationsDatasourceUID: string | null | undefined;
}

/**
 * Validates that Step 1 form is complete and valid
 */
export function isStep1Valid(params: Step1ValidationParams): boolean {
  const { policyTreeName, notificationsSource, notificationsYamlFile, notificationsDatasourceUID } = params;

  if (!policyTreeName) {
    return false;
  }
  return hasValidSourceSelection(notificationsSource, notificationsYamlFile, notificationsDatasourceUID);
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

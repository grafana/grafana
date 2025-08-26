import { load } from 'js-yaml';

import { RulerCloudRuleDTO, RulerRuleGroupDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

interface PrometheusYamlFile {
  namespace?: string;
  groups: Array<RulerRuleGroupDTO<RulerCloudRuleDTO>>;
}

function isValidObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && Boolean(value);
}

function isRule(yamlRule: unknown): yamlRule is RulerCloudRuleDTO {
  if (!isValidObject(yamlRule)) {
    return false;
  }

  const alert = 'alert' in yamlRule && typeof yamlRule.alert === 'string' ? yamlRule.alert : undefined;
  const record = 'record' in yamlRule && typeof yamlRule.record === 'string' ? yamlRule.record : undefined;
  const expr = 'expr' in yamlRule && typeof yamlRule.expr === 'string' ? yamlRule.expr : undefined;

  if (!expr) {
    return false;
  }

  if (!alert && !record) {
    return false;
  }

  // If both are specified we don't know which one to use
  if (alert && record) {
    return false;
  }

  // Check optional properties if they exist
  if ('for' in yamlRule && typeof yamlRule.for !== 'string') {
    return false;
  }

  if ('labels' in yamlRule && !isValidObject(yamlRule.labels)) {
    return false;
  }

  if ('annotations' in yamlRule && !isValidObject(yamlRule.annotations)) {
    return false;
  }

  return true;
}

function isGroup(obj: unknown): obj is RulerRuleGroupDTO<RulerCloudRuleDTO> {
  if (!isValidObject(obj)) {
    return false;
  }

  const name = 'name' in obj && typeof obj.name === 'string' ? obj.name : undefined;
  const rules = 'rules' in obj && Array.isArray(obj.rules) ? obj.rules : undefined;

  if (!name || !rules) {
    return false;
  }

  return rules.every(isRule);
}

type ValidationResult = { isValid: true; data: PrometheusYamlFile } | { isValid: false; error: string };

function validatePrometheusYamlFile(obj: unknown): ValidationResult {
  if (!isValidObject(obj)) {
    return { isValid: false, error: 'Invalid YAML format: missing or invalid groups array' };
  }

  if (!('groups' in obj) || ('groups' in obj && !Array.isArray(obj.groups))) {
    return { isValid: false, error: 'Invalid YAML format: missing or invalid groups array' };
  }

  // Check if groups is an array
  if (!Array.isArray(obj.groups)) {
    return { isValid: false, error: 'Invalid YAML format: missing or invalid groups array' };
  }

  // Check optional namespace property if it exists
  if ('namespace' in obj && typeof obj.namespace !== 'string') {
    return { isValid: false, error: 'Invalid YAML format: namespace must be a string' };
  }

  // If we get here, the object is valid - we can safely use it
  // Since we validated the entire structure above, we know obj conforms to PrometheusYamlFile
  const validatedGroups = obj.groups.map((group, index) => {
    if (isGroup(group)) {
      return group;
    }
    throw new Error(`Invalid YAML format: missing or invalid groups array at index ${index}`);
  });

  const prometheusFile: PrometheusYamlFile = {
    groups: validatedGroups,
  };

  if ('namespace' in obj && typeof obj.namespace === 'string') {
    prometheusFile.namespace = obj.namespace;
  }

  return {
    isValid: true,
    data: prometheusFile,
  };
}

// only use this function directly for testing purposes, use parseYamlFileToRulerRulesConfigDTO instead
export function parseYamlToRulerRulesConfigDTO(yamlAsString: string, defaultNamespace: string): RulerRulesConfigDTO {
  const obj = load(yamlAsString);
  const validation = validatePrometheusYamlFile(obj);

  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  // TypeScript now knows validation.data exists and is PrometheusYamlFile
  const prometheusFile = validation.data;
  const namespace = prometheusFile.namespace ?? defaultNamespace;

  return {
    [namespace]: prometheusFile.groups,
  };
}

export async function parseYamlFileToRulerRulesConfigDTO(
  file: File,
  defaultNamespace: string
): Promise<RulerRulesConfigDTO> {
  const yamlContent = await file.text();
  return parseYamlToRulerRulesConfigDTO(yamlContent, defaultNamespace);
}

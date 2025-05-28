import { load } from 'js-yaml';

import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

interface PrometheusYamlFile {
  namespace?: string;
  groups: Group[];
}

interface Group {
  name: string;
  rules: Rule[];
}

interface Rule {
  alert: string;
  expr: string;
  for?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

function isValidObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && Boolean(value);
}

function isRule(yamlRule: unknown): yamlRule is Rule {
  if (!isValidObject(yamlRule)) {
    return false;
  }

  const alert = 'alert' in yamlRule && typeof yamlRule.alert === 'string' ? yamlRule.alert : undefined;
  const expr = 'expr' in yamlRule && typeof yamlRule.expr === 'string' ? yamlRule.expr : undefined;

  if (!alert || !expr) {
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

function isGroup(obj: unknown): obj is Group {
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
  const validatedGroups: Group[] = obj.groups.map((group, index) => {
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

export function parseYamlToRulerRulesConfigDTO(yamlAsString: string, defaultNamespace: string): RulerRulesConfigDTO {
  const obj = load(yamlAsString);
  const validation = validatePrometheusYamlFile(obj);

  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  // TypeScript now knows validation.data exists and is PrometheusYamlFile
  const prometheusFile = validation.data;
  const namespace = prometheusFile.namespace ?? defaultNamespace;

  const data: RulerRulesConfigDTO = {};
  data[namespace] = prometheusFile.groups.map((group) => {
    return {
      name: group.name,
      rules: group.rules.map((rule) => {
        return {
          alert: rule.alert,
          expr: rule.expr,
          for: rule.for,
          labels: rule.labels,
          annotations: rule.annotations,
        };
      }),
    };
  });

  return data;
}

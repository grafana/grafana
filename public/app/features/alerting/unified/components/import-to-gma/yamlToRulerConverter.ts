import { load } from "js-yaml";

import { RulerRulesConfigDTO } from "app/types/unified-alerting-dto";

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

function isValidString(value: unknown): value is string {
  return typeof value === 'string';
}

function isValidObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && Boolean(value);
}

function hasRequiredProperties(obj: Record<string, unknown>, properties: string[]): boolean {
  return properties.every(prop => prop in obj);
}

function isRule(obj: unknown): obj is Rule {
  if (!isValidObject(obj)) {
    return false;
  }

  const requiredProps = ['alert', 'expr'];
  if (!hasRequiredProperties(obj, requiredProps)) {
    return false;
  }

  const rule = obj as unknown as Rule;
  if (!isValidString(rule.alert) || !isValidString(rule.expr)) {
    return false;
  }

  // Check optional properties if they exist
  if ('for' in rule && !isValidString(rule.for)) {
    return false;
  }

  if ('labels' in rule && !isValidObject(rule.labels)) {
    return false;
  }

  if ('annotations' in rule && !isValidObject(rule.annotations)) {
    return false;
  }

  return true;
}

function isGroup(obj: unknown): obj is Group {
  if (!isValidObject(obj)) {
    return false;
  }

  const requiredProps = ['name', 'rules'];
  if (!hasRequiredProperties(obj, requiredProps)) {
    return false;
  }

  const group = obj as unknown as Group;
  if (!isValidString(group.name) || !Array.isArray(group.rules)) {
    return false;
  }

  return group.rules.every(isRule);
}

export function parseYamlToRulerRulesConfigDTO(yamlAsString: string, defaultNamespace: string): RulerRulesConfigDTO {

  const obj = load(yamlAsString);
  if (!obj || typeof obj !== 'object' || !('groups' in obj) || !Array.isArray((obj as { groups: unknown[] }).groups)) {
    throw new Error('Invalid YAML format: missing or invalid groups array');
  }

  const namespace = 'namespace' in obj && isValidString(obj.namespace) ? obj.namespace : defaultNamespace;

  const data: RulerRulesConfigDTO = {};
  data[namespace] = (obj as { groups: unknown[] }).groups.map((group: unknown) => {
    if (!isGroup(group)) {
      throw new Error('Invalid group format: missing name or rules array');
    }

    return {
      name: group.name,
      rules: group.rules.map((rule: unknown) => {
        if (!isRule(rule)) {
          throw new Error('Invalid rule format: missing alert or expr');
        }

        return {
          alert: rule.alert,
          expr: rule.expr,
          for: rule.for,
          labels: rule.labels,
          annotations: rule.annotations
        };
      })
    };
  });

  return data;
}

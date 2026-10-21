/**
 * Runtime migration: Threshold.valueExpr → FieldConfig.varMappings.
 *
 * Each non-base step's valueExpr moves to the varMappings key for its index, in the defaults map or
 * as a varMappings.<key> entry in the same override rule. An existing mapping for that key wins.
 * The valueExpr is removed from every step.
 *
 * Since this is a runtime layer the schema will not be persisted until the user saves the dashboard.
 */
import {
  type DynamicConfigValue,
  type FieldConfig,
  type FieldConfigSource,
  type ThresholdsConfig,
} from '@grafana/data';
import { thresholdStepVarMappingKey, wrapVarMappingPropId } from '@grafana/data/internal';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

export function migrateThresholdValueExprs(fieldConfig: FieldConfigSource): FieldConfigSource {
  if (!fieldConfig || !getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaPanelOptionInterpolation, false)) {
    return fieldConfig;
  }

  const defaults = migrateDefaults(fieldConfig.defaults);
  let overridesChanged = false;
  const overrides = fieldConfig.overrides?.map((rule) => {
    const properties = migrateOverrideProperties(rule.properties);
    if (properties === rule.properties) {
      return rule;
    }
    overridesChanged = true;
    return { ...rule, properties };
  });

  if (defaults === fieldConfig.defaults && !overridesChanged) {
    return fieldConfig;
  }

  return { ...fieldConfig, defaults, overrides };
}

function hasValueExpr(thresholds: ThresholdsConfig | undefined): thresholds is ThresholdsConfig {
  return Array.isArray(thresholds?.steps) && thresholds.steps.some((step) => step.valueExpr !== undefined);
}

function extractValueExprs(thresholds: ThresholdsConfig) {
  const expressions: Record<string, string> = {};
  const steps = thresholds.steps.map(({ valueExpr, ...step }, index) => {
    // The base step is always -Infinity, so an expression there has never applied
    if (index > 0 && valueExpr) {
      expressions[thresholdStepVarMappingKey(index)] = valueExpr;
    }
    return step;
  });

  return { thresholds: { ...thresholds, steps }, expressions };
}

function migrateDefaults(defaults: FieldConfig): FieldConfig {
  if (!hasValueExpr(defaults?.thresholds)) {
    return defaults;
  }

  const { thresholds, expressions } = extractValueExprs(defaults.thresholds);
  const varMappings = { ...expressions, ...defaults.varMappings };

  return {
    ...defaults,
    thresholds,
    ...(Object.keys(varMappings).length > 0 ? { varMappings } : {}),
  };
}

function migrateOverrideProperties(properties: DynamicConfigValue[]): DynamicConfigValue[] {
  const thresholdsIndex = properties.findIndex((prop) => prop.id === 'thresholds' && hasValueExpr(prop.value));
  if (thresholdsIndex === -1) {
    return properties;
  }

  const { thresholds, expressions } = extractValueExprs(properties[thresholdsIndex].value);
  const migrated = properties.map((prop, index) => (index === thresholdsIndex ? { ...prop, value: thresholds } : prop));

  for (const [key, expression] of Object.entries(expressions)) {
    const id = wrapVarMappingPropId(key);
    if (!migrated.some((prop) => prop.id === id)) {
      migrated.push({ id, value: expression });
    }
  }

  return migrated;
}

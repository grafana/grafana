import { get as lodashGet } from 'lodash';

import { type DataFrame, type FieldConfigPropertyItem, type FieldConfigSource } from '@grafana/data';
import { hasVarMappingVariableReference, isVarMappingProp, unwrapVarMappingPropId } from '@grafana/data/internal';
import { t } from '@grafana/i18n';

import { type OptionPaneItemOverrideInfo } from '../types';

export const dataOverrideTooltipDescription =
  'Some data fields have this option pre-configured. Add a field override rule to override the pre-configured value.';
export const overrideRuleTooltipDescription = 'An override rule exists for this property';

export function getOptionOverrides(
  fieldOption: FieldConfigPropertyItem,
  fieldConfig: FieldConfigSource,
  frames: DataFrame[] | undefined
): OptionPaneItemOverrideInfo[] {
  const infoDots: OptionPaneItemOverrideInfo[] = [];

  // Look for options overriden in data field config
  if (frames) {
    for (const frame of frames) {
      for (const field of frame.fields) {
        const value = lodashGet(field.config, fieldOption.path);
        if (value == null) {
          continue;
        }

        infoDots.push({
          type: 'data',
          description: dataOverrideTooltipDescription,
          tooltip: dataOverrideTooltipDescription,
        });

        break;
      }
    }
  }

  const overrideRuleFound = fieldConfig.overrides.some((rule) =>
    rule.properties.some((prop) => prop.id === fieldOption.id)
  );

  if (overrideRuleFound) {
    infoDots.push({
      type: 'rule',
      description: overrideRuleTooltipDescription,
      tooltip: overrideRuleTooltipDescription,
    });
  }

  return infoDots;
}

/**
 * Marks an option that takes a variable, or a text option with variables in it, in the defaults or
 * in an override rule. The variables can be dashboard, global or data variables, so the tooltip
 * doesn't name a kind.
 */
export function getVarMappingOptionOverrides(
  fieldOption: FieldConfigPropertyItem,
  fieldConfig: FieldConfigSource
): OptionPaneItemOverrideInfo[] {
  const isMappedKey = (key: string) => key === fieldOption.id;
  const usesVariables =
    Object.keys(fieldConfig.defaults.varMappings ?? {}).some(isMappedKey) ||
    fieldConfig.overrides.some((rule) =>
      rule.properties.some((prop) => isVarMappingProp(prop) && isMappedKey(unwrapVarMappingPropId(prop.id)))
    ) ||
    usesVariablesInText(fieldOption, fieldConfig);

  if (!usesVariables) {
    return [];
  }

  const description = t('dashboard.get-var-mapping-option-overrides.uses-variables', 'This option uses variables');
  return [{ type: 'variable', description, tooltip: description }];
}

/**
 * Whether a string option that already interpolates its text, such as the display name, holds a
 * variable in the defaults or in an override rule
 */
function usesVariablesInText(fieldOption: FieldConfigPropertyItem, fieldConfig: FieldConfigSource): boolean {
  if (fieldOption.settings?.expandTemplateVars !== true) {
    return false;
  }
  const hasVariable = (value: unknown) => typeof value === 'string' && hasVarMappingVariableReference(value);

  return (
    hasVariable(lodashGet(fieldConfig.defaults, fieldOption.id)) ||
    fieldConfig.overrides.some((rule) =>
      rule.properties.some((prop) => prop.id === fieldOption.id && hasVariable(prop.value))
    )
  );
}

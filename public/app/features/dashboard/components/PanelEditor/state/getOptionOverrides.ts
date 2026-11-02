import { get as lodashGet } from 'lodash';

import {
  type DataFrame,
  FieldConfigProperty,
  type FieldConfigPropertyItem,
  type FieldConfigSource,
} from '@grafana/data';
import { isThresholdStepVarMappingKey, isVarMappingProp, unwrapVarMappingPropId } from '@grafana/data/internal';
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

/** Marks an option that takes a dashboard variable, in the defaults or in an override rule */
export function getVarMappingOptionOverrides(
  fieldOption: FieldConfigPropertyItem,
  fieldConfig: FieldConfigSource
): OptionPaneItemOverrideInfo[] {
  const isMappedKey = (key: string) =>
    fieldOption.id === FieldConfigProperty.Thresholds ? isThresholdStepVarMappingKey(key) : key === fieldOption.id;

  let description: string | undefined;
  if (Object.keys(fieldConfig.defaults.varMappings ?? {}).some(isMappedKey)) {
    description = t(
      'dashboard.get-var-mapping-option-overrides.defaults',
      'This option takes its value from a dashboard variable'
    );
  } else if (
    fieldConfig.overrides.some((rule) =>
      rule.properties.some((prop) => isVarMappingProp(prop) && isMappedKey(unwrapVarMappingPropId(prop.id)))
    )
  ) {
    description = t(
      'dashboard.get-var-mapping-option-overrides.rule',
      'An override rule sets this option from a dashboard variable'
    );
  }

  return description ? [{ type: 'variable', description, tooltip: description }] : [];
}

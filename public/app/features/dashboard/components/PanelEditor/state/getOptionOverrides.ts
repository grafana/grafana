import { get as lodashGet } from 'lodash';

import { DataFrame, FieldConfigPropertyItem, FieldConfigSource } from '@grafana/data';

import { OptionPaneItemOverrideInfo } from '../types';

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

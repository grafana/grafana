import { get as lodashGet } from 'lodash';
export const dataOverrideTooltipDescription = 'Some data fields have this option pre-configured. Add a field override rule to override the pre-configured value.';
export const overrideRuleTooltipDescription = 'An override rule exists for this property';
export function getOptionOverrides(fieldOption, fieldConfig, frames) {
    const infoDots = [];
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
    const overrideRuleFound = fieldConfig.overrides.some((rule) => rule.properties.some((prop) => prop.id === fieldOption.id));
    if (overrideRuleFound) {
        infoDots.push({
            type: 'rule',
            description: overrideRuleTooltipDescription,
            tooltip: overrideRuleTooltipDescription,
        });
    }
    return infoDots;
}
//# sourceMappingURL=getOptionOverrides.js.map
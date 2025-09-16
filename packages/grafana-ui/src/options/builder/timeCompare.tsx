import { PanelOptionsEditorBuilder } from '@grafana/data';
import { TimeCompareOptions } from '@grafana/schema';

/**
 * Adds a generic time comparison option to the panel options editor.
 * Can be used by any panel that supports time comparison.
 */
export function addTimeCompareOption<T extends { timeCompare?: TimeCompareOptions }>(
  builder: PanelOptionsEditorBuilder<T>,
  defaultValue = false
) {
  builder.addBooleanSwitch({
    path: 'timeCompare',
    name: 'Show comparison selector',
    category: ['Time Comparison'],
    description: 'Enables the comparison selector, so you can compare data between two time ranges',
    defaultValue,
  });
}

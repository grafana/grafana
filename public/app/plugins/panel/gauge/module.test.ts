import { createDataFrame, FieldType, standardEditorsRegistry } from '@grafana/data';
import { getAllOptionEditors } from 'app/core/components/OptionsUI/registry';

import { plugin } from './module';

standardEditorsRegistry.setInit(getAllOptionEditors);

describe('gauge module', () => {
  it('registers a Scale field option in the gauge category that applies to number fields only', () => {
    const scale = plugin.fieldConfigRegistry.get('custom.scaleDistribution');
    const [numberField, stringField] = createDataFrame({
      fields: [
        { name: 'value', type: FieldType.number, values: [1] },
        { name: 'name', type: FieldType.string, values: ['a'] },
      ],
    }).fields;

    expect(scale.category).toEqual(['Gauge']);
    expect(scale.shouldApply(numberField)).toBe(true);
    expect(scale.shouldApply(stringField)).toBe(false);
  });
});

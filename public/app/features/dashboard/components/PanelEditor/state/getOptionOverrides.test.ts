import { type FieldConfigPropertyItem, type FieldConfigSource } from '@grafana/data';

import { getVarMappingOptionOverrides } from './getOptionOverrides';

const option = (id: string) => ({ id }) as FieldConfigPropertyItem;

describe('getVarMappingOptionOverrides', () => {
  it('marks an option mapped in the defaults', () => {
    const fieldConfig: FieldConfigSource = { defaults: { varMappings: { min: '$min' } }, overrides: [] };

    expect(getVarMappingOptionOverrides(option('min'), fieldConfig)).toEqual([
      expect.objectContaining({ type: 'variable', tooltip: 'This option takes its value from a dashboard variable' }),
    ]);
    expect(getVarMappingOptionOverrides(option('max'), fieldConfig)).toEqual([]);
  });

  it('marks an option mapped in an override rule', () => {
    const fieldConfig: FieldConfigSource = {
      defaults: {},
      overrides: [{ matcher: { id: 'byName', options: 'A' }, properties: [{ id: 'varMappings.min', value: '$min' }] }],
    };

    expect(getVarMappingOptionOverrides(option('min'), fieldConfig)).toEqual([
      expect.objectContaining({ tooltip: 'An override rule sets this option from a dashboard variable' }),
    ]);
  });
});

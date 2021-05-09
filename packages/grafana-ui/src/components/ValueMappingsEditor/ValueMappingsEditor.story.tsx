import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';
import { ValueMappingsEditor } from './ValueMappingsEditor';
import { MappingType, ValueMapping } from '@grafana/data';

export default {
  title: 'Pickers and Editors/ValueMappingsEditor',
  component: ValueMappingsEditor,
};

export function Example() {
  const [mappings, setMappings] = useState<ValueMapping[]>([
    {
      type: MappingType.ValueToText,
      id: 0,
      map: {
        LowLow: { color: 'red' },
        Low: { value: -1, color: 'orange' },
        Ok: { state: 'all good', color: 'green' },
      },
    },
  ]);

  return <ValueMappingsEditor value={mappings} onChange={action('Mapping changed')} />;
}

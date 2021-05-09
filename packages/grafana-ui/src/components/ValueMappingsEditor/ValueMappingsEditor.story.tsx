import React, { useState } from 'react';
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
      options: {
        LowLow: { color: 'red' },
        Low: { value: -1, color: 'orange' },
        Ok: { state: 'all good', color: 'green' },
        NoColor: { state: 'Unknown' },
      },
    },
  ]);

  return <ValueMappingsEditor value={mappings} onChange={setMappings} />;
}

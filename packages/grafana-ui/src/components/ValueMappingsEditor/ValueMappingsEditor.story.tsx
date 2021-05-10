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
        Low: { text: 'not good', color: 'orange' },
        Ok: { text: 'all good', color: 'green' },
        NoColor: { text: 'Unknown' },
      },
    },
    {
      type: MappingType.RangeToText,
      options: {
        from: 10,
        to: 15,
        result: {
          index: 5,
          text: 'bad',
          color: 'red',
        },
      },
    },
  ]);

  return <ValueMappingsEditor value={mappings} onChange={setMappings} />;
}

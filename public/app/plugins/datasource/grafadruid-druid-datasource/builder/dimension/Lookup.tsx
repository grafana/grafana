import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Checkbox, Row } from '../abstract';
import { Lookup as LookupExtractor } from '../lookup';

export const Lookup = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Lookup);
  return (
    <>
      <Row>
        <Input {...scopedProps('dimension')} label="Dimension" description="The dimension name" type="text" />
        <Input
          {...scopedProps('outputName')}
          label="Output name"
          description="The, optionnal, dimension output name"
          type="text"
        />
      </Row>
      <Row>
        <Input
          {...scopedProps('name')}
          label="Name"
          description="The registered lookup name (exclusive, this or lookup field below)"
          type="text"
        />
      </Row>
      <Row>
        <LookupExtractor {...scopedProps('lookup')} />
      </Row>
      <Row>
        <Checkbox
          {...scopedProps('retainMissingValue')}
          label="Retain missing value"
          description="Specifies if the missing value should be retained"
        />
      </Row>
      <Row>
        <Input
          {...scopedProps('replaceMissingValueWith')}
          label="Replace missing value with"
          description="The missing value replacement text"
          type="text"
        />
      </Row>
      <Row>
        <Checkbox
          {...scopedProps('injective')}
          label="Injective?"
          description="Specifies if the lookup is injective or not"
        />
        <Checkbox
          {...scopedProps('optimize')}
          label="Optimize?"
          description="Specifies if the lookup should be optimized"
        />
      </Row>
    </>
  );
};
Lookup.type = 'lookup';
Lookup.fields = [
  'dimension',
  'outputName',
  'name',
  'lookup',
  'retainMissingValue',
  'replaceMissingValueWith',
  'injective',
  'optimize',
];

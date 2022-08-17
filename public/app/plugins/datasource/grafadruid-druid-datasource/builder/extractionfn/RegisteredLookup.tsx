import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Checkbox, Row } from '../abstract';

export const RegisteredLookup = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, RegisteredLookup);
  return (
    <>
      <Row>
        <Input {...scopedProps('lookup')} label="Lookup" description="The lookup name" type="text" />
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
          {...scopedProps('retainMissingValue')}
          label="Retain missing value?"
          description="Specifies if the missing value should be retained"
        />
        <Checkbox {...scopedProps('injective')} label="Injective?" description="Specifies if the lookup is injective" />
        <Checkbox
          {...scopedProps('optimize')}
          label="Optimize?"
          description="Specifies if the lookup should be optimized"
        />
      </Row>
    </>
  );
};
RegisteredLookup.type = 'registeredLookup';
RegisteredLookup.fields = ['lookup', 'retainMissingValue', 'replaceMissingValueWith', 'injective', 'optimize'];

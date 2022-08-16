import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Row } from '../abstract';

export const Lookup = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Lookup);
  return (
    <Row>
      <Input {...scopedProps('lookup')} label="Lookup" description="The lookup table name" type="text" />
    </Row>
  );
};
Lookup.type = 'lookup';
Lookup.fields = ['lookup'];

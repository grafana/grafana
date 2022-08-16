import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Select, Row } from '../abstract';

export const Dimension = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Dimension);
  return (
    <Row>
      <Select
        {...scopedProps('ordering')}
        label="Ordering"
        description="Specifies the sorting order to use when comparing values against the dimension."
        entries={{
          lexicographic: 'Lexicographic',
          alphanumeric: 'Alphanumeric',
          strlen: 'String len',
          numeric: 'Numeric',
          version: 'Version',
        }}
      />
      <Input
        {...scopedProps('previousStop')}
        label="Previous stop"
        description="The starting point of the sort"
        type="text"
      />
    </Row>
  );
};
Dimension.type = 'dimension';
Dimension.fields = ['ordering', 'previousStop'];

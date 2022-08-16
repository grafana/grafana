import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Select, Multiple, Row } from '../abstract';
import { PostAggregation } from './.';

export const Arithmetic = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Arithmetic);
  return (
    <>
      <Row>
        <Input {...scopedProps('name')} label="Name" description="Output name for the summed value" type="text" />
        <Select
          {...scopedProps('fn')}
          label="Function"
          description="Specifies the function to apply on the given fields from left to right"
          entries={{
            '+': 'Plus',
            '-': 'Minus',
            '*': 'Multiply',
            '/': 'Divide',
            quotient: 'Quotient',
          }}
        />
      </Row>
      <Row>
        <Multiple
          {...scopedProps('fields')}
          label="Fields"
          description="The post-aggregators fields to apply the function to"
          component={PostAggregation}
          componentExtraProps={{}}
        />
      </Row>
      <Row>
        <Select
          {...scopedProps('ordering')}
          label="Ordering"
          description="Specifies the order of resulting values when sorting results (this can be useful for topN queries for instance)."
          entries={{
            null: 'Null',
            numericFirst: 'Numeric first',
          }}
        />
      </Row>
    </>
  );
};
Arithmetic.type = 'arithmetic';
Arithmetic.fields = ['name', 'fn', 'fields', 'ordering'];

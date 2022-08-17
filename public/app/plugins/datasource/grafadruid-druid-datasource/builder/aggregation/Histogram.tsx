import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Multiple, Row } from '../abstract';

export const Histogram = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Histogram);
  return (
    <Row>
      <Input {...scopedProps('name')} label="Name" description="Output name for the summed value" type="text" />
      <Input
        {...scopedProps('fieldName')}
        label="Field name"
        description="Name of the metric column to sum over"
        type="text"
      />
      <Multiple
        {...scopedProps('breaks')}
        label="Breaks"
        description="The histogram breaks"
        component={Input}
        componentExtraProps={{
          label: 'Break',
          description: 'An histogram break',
          type: 'number',
        }}
      />
    </Row>
  );
};
Histogram.type = 'histogram';
Histogram.fields = ['name', 'fieldName', 'breaks'];

import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Row } from '../abstract';

export const QuantilesDoublesSketch = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, QuantilesDoublesSketch);
  return (
    <Row>
      <Input {...scopedProps('name')} label="Name" description="Output name for the sketch" type="text" />
      <Input
        {...scopedProps('fieldName')}
        label="Field name"
        description="Name of the metric column to create a sketch"
        type="text"
      />
      <Input {...scopedProps('k')} label="k" description="Parameter that controls size and accuracy" type="number" />
    </Row>
  );
};
QuantilesDoublesSketch.type = 'quantilesDoublesSketch';
QuantilesDoublesSketch.fields = ['name', 'fieldName', 'k'];

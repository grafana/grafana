import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Row } from '../abstract';

export const StringFirstFolding = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, StringFirstFolding);
  return (
    <Row>
      <Input {...scopedProps('name')} label="Name" description="Output name for the summed value" type="text" />
      <Input
        {...scopedProps('fieldName')}
        label="Field name"
        description="Name of the metric column to sum over"
        type="text"
      />
      <Input {...scopedProps('maxStringBytes')} label="Max string bytes" description="Max string bytes" type="number" />
    </Row>
  );
};
StringFirstFolding.type = 'stringFirstFolding';
StringFirstFolding.fields = ['name', 'fieldName', 'maxStringBytes'];

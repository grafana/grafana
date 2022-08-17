import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Checkbox, Multiple, Row } from '../abstract';

export const Cardinality = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Cardinality);
  return (
    <>
      <Row>
        <Input {...scopedProps('name')} label="Name" description="Output name for the summed value" type="text" />
      </Row>
      <Row>
        <Multiple
          {...scopedProps('fields')}
          label="Dimensions"
          description="The dimensions names"
          component={Input}
          componentExtraProps={{
            label: 'Dimension',
            description: 'A dimension name',
            type: 'text',
          }}
        />
      </Row>
      <Row>
        <Checkbox
          {...scopedProps('byRow')}
          label="By row"
          description="Set to true to computes the cardinality by row, i.e. the cardinality of distinct dimension combinations"
        />
        <Checkbox
          {...scopedProps('round')}
          label="Round"
          description="Set to true to round off estimated values to whole numbers"
        />
      </Row>
    </>
  );
};
Cardinality.type = 'cardinality';
Cardinality.fields = ['name', 'fields', 'byRow', 'round'];

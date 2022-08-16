import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Multiple, Row } from '../abstract';
import { Dimension } from '../dimension';

export const ColumnComparison = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, ColumnComparison);
  return (
    <Row>
      <Multiple
        {...scopedProps('dimensions')}
        label="Dimensions"
        description="The dimensions"
        component={Dimension}
        componentExtraProps={{}}
      />
    </Row>
  );
};
ColumnComparison.type = 'columnComparison';
ColumnComparison.fields = ['dimensions'];

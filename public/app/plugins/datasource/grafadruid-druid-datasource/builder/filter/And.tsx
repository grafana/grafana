import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Multiple, Row } from '../abstract';
import { Filter } from './';

export const And = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, And);
  return (
    <Row>
      <Multiple
        {...scopedProps('fields')}
        label="Fields"
        description="The filter fields"
        component={Filter}
        componentExtraProps={{}}
      />
    </Row>
  );
};
And.type = 'and';
And.fields = ['fields'];

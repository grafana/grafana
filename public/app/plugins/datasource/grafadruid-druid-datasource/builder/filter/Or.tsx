import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Multiple, Row } from '../abstract';
import { Filter } from './';

export const Or = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Or);
  return (
    <>
      <Row>
        <Multiple
          {...scopedProps('fields')}
          label="Filters"
          description="The filters"
          component={Filter}
          componentExtraProps={{}}
        />
      </Row>
    </>
  );
};
Or.type = 'or';
Or.fields = ['fields'];

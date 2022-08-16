import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Multiple, Row } from '../abstract';
import { PostAggregation } from './.';

export const DoubleLeast = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, DoubleLeast);
  return (
    <>
      <Row>
        <Input {...scopedProps('name')} label="Name" description="Output name for the value" type="text" />
      </Row>
      <Row>
        <Multiple
          {...scopedProps('fields')}
          label="Fields"
          description="The post-aggregators fields to returns the least value from"
          component={PostAggregation}
          componentExtraProps={{}}
        />
      </Row>
    </>
  );
};
DoubleLeast.type = 'doubleLeast';
DoubleLeast.fields = ['name', 'fields'];

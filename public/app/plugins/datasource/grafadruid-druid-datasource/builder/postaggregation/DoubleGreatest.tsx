import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Multiple, Row } from '../abstract';
import { PostAggregation } from './.';

export const DoubleGreatest = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, DoubleGreatest);
  return (
    <>
      <Row>
        <Input {...scopedProps('name')} label="Name" description="Output name for the value" type="text" />
      </Row>
      <Row>
        <Multiple
          {...scopedProps('fields')}
          label="Fields"
          description="The post-aggregators fields to returns the greatest value from"
          component={PostAggregation}
          componentExtraProps={{}}
        />
      </Row>
    </>
  );
};
DoubleGreatest.type = 'doubleGreatest';
DoubleGreatest.fields = ['name', 'fields'];

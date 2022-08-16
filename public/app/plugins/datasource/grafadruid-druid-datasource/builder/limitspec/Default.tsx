import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Multiple, Row } from '../abstract';
import { OrderByColumnSpecs } from '.';

export const Default = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Default);
  return (
    <>
      <Row>
        <Input
          {...scopedProps('limit')}
          label="Limit"
          description="The amount of rows to keep from the set of results"
          type="number"
        />
      </Row>
      <Row>
        <Multiple
          {...scopedProps('columns')}
          label="Order by columns"
          description="The specifications used to indicate how to do order by operations."
          component={OrderByColumnSpecs}
          componentExtraProps={{}}
        />
      </Row>
    </>
  );
};
Default.type = 'default';
Default.fields = ['limit', 'columns'];

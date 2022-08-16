import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderProps, useScopedQueryBuilderFieldProps, Input, Select, Row } from '../abstract';
import { DataSource } from '.';

export const Join = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Join);
  const scopedComponentProps = useScopedQueryBuilderProps(props, Join);
  return (
    <>
      <Row>
        <DataSource {...scopedComponentProps('left')} />
      </Row>
      <Row>
        <DataSource {...scopedComponentProps('right')} />
      </Row>
      <Row>
        <Input
          {...scopedProps('rightPrefix')}
          label="Right prefix"
          description="The right datasource prefix"
          type="text"
        />
        <Input
          {...scopedProps('condition')}
          label="Condition"
          description="The join condition expression"
          type="text"
        />
        <Select
          {...scopedProps('joinType')}
          label="Join type"
          description="The join type"
          entries={{ INNER: 'Inner', LEFT: 'Left' }}
        />
      </Row>
    </>
  );
};
Join.type = 'join';
Join.fields = ['left', 'right', 'rightPrefix', 'condition', 'joinType'];

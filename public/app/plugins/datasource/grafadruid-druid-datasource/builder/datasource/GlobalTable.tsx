import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Row } from '../abstract';

export const GlobalTable = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, GlobalTable);
  return (
    <Row>
      <Input {...scopedProps('name')} label="Name" description="The global table name" type="text" />
    </Row>
  );
};
GlobalTable.type = 'globalTable';
GlobalTable.fields = ['name'];

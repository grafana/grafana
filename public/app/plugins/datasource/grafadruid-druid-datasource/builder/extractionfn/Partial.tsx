import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Row } from '../abstract';

export const Partial = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Partial);
  return (
    <Row>
      <Input {...scopedProps('expr')} label="Expression" description="The regular expression" type="text" />
    </Row>
  );
};
Partial.type = 'partial';
Partial.fields = ['expr'];

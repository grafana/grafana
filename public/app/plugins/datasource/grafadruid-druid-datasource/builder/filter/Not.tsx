import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Row } from '../abstract';
import { Filter } from './';

export const Not = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Not);
  return (
    <Row>
      <Filter {...scopedProps('field')} />
    </Row>
  );
};
Not.type = 'not';
Not.fields = ['field'];

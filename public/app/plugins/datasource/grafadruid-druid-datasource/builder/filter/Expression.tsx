import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Row } from '../abstract';
import { FilterTuning } from '.';

export const Expression = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Expression);
  return (
    <>
      <Row>
        <Input {...scopedProps('expression')} label="Expression" description="The expression" type="text" />
      </Row>
      <Row>
        <FilterTuning {...scopedProps('filterTuning')} />
      </Row>
    </>
  );
};
Expression.type = 'expression';
Expression.fields = ['expression', 'filterTuning'];

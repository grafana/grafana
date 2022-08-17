import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderProps, Row } from '../abstract';
import { Query as QuerySelector } from '../query';

export const Query = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderProps(props, Query);
  return (
    <Row>
      <QuerySelector {...scopedProps('query')} />
    </Row>
  );
};
Query.type = 'query';
Query.fields = ['query'];

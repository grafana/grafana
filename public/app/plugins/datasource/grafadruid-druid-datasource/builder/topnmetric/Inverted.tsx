import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderProps, Row } from '../abstract';
import { TopNMetric } from './';

export const Inverted = (props: QueryBuilderProps) => {
  const scopedComponentProps = useScopedQueryBuilderProps(props, Inverted);
  return (
    <Row>
      <TopNMetric {...scopedComponentProps('metric')} />
    </Row>
  );
};
Inverted.type = 'inverted';
Inverted.fields = ['metric'];

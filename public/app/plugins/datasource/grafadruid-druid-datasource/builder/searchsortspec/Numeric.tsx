import React from 'react';
import { QueryBuilderProps } from '../types';
import { useQueryBuilderAutoSubmit, Row } from '../abstract';

export const Numeric = (props: QueryBuilderProps) => {
  useQueryBuilderAutoSubmit(props, Numeric);
  return <Row>Numeric.</Row>;
};
Numeric.type = 'numeric';
Numeric.fields = [] as string[];

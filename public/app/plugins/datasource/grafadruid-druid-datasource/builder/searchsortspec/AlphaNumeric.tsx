import React from 'react';
import { QueryBuilderProps } from '../types';
import { useQueryBuilderAutoSubmit, Row } from '../abstract';

export const AlphaNumeric = (props: QueryBuilderProps) => {
  useQueryBuilderAutoSubmit(props, AlphaNumeric);
  return <Row>AlphaNumeric.</Row>;
};
AlphaNumeric.type = 'alphanumeric';
AlphaNumeric.fields = [] as string[];

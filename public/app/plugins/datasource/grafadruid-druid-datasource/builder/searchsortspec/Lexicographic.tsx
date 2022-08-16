import React from 'react';
import { QueryBuilderProps } from '../types';
import { useQueryBuilderAutoSubmit, Row } from '../abstract';

export const Lexicographic = (props: QueryBuilderProps) => {
  useQueryBuilderAutoSubmit(props, Lexicographic);
  return <Row>Lexicographic.</Row>;
};
Lexicographic.type = 'lexicographic';
Lexicographic.fields = [] as string[];

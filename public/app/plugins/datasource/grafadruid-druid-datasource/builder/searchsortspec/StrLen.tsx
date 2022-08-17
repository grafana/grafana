import React from 'react';
import { QueryBuilderProps } from '../types';
import { useQueryBuilderAutoSubmit, Row } from '../abstract';

export const StrLen = (props: QueryBuilderProps) => {
  useQueryBuilderAutoSubmit(props, StrLen);
  return <Row>StrLen.</Row>;
};
StrLen.type = 'strlen';
StrLen.fields = [] as string[];

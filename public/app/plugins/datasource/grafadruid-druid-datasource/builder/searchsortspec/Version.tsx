import React from 'react';
import { QueryBuilderProps } from '../types';
import { useQueryBuilderAutoSubmit, Row } from '../abstract';

export const Version = (props: QueryBuilderProps) => {
  useQueryBuilderAutoSubmit(props, Version);
  return <Row>Version.</Row>;
};
Version.type = 'version';
Version.fields = [] as string[];

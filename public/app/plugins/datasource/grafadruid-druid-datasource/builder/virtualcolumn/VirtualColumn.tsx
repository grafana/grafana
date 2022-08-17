import React from 'react';
import { QueryBuilderProps } from '../types';
import { QueryBuilderComponentSelector } from '../abstract';
import { Expression } from './';

export const VirtualColumn = (props: QueryBuilderProps) => (
  <QueryBuilderComponentSelector {...props} label="VirtualColumn" components={{ Expression: Expression }} />
);

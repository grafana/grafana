import React from 'react';
import { QueryBuilderProps } from '../types';
import { QueryBuilderComponentSelector } from '../abstract';
import { All, List, None } from './';

export const ToInclude = (props: QueryBuilderProps) => (
  <QueryBuilderComponentSelector {...props} label="ToInclude" components={{ All: All, List: List, None: None }} />
);

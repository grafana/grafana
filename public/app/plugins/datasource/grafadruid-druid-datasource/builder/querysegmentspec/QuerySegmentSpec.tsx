import React from 'react';
import { QueryBuilderProps } from '../types';
import { QueryBuilderComponentSelector } from '../abstract';
import { Intervals } from './';

export const QuerySegmentSpec = (props: QueryBuilderProps) => (
  <QueryBuilderComponentSelector {...props} label="QuerySegmentSpec" components={{ Intervals: Intervals }} />
);

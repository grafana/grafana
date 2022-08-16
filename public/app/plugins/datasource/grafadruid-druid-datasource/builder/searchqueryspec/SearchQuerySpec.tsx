import React from 'react';
import { QueryBuilderProps } from '../types';
import { QueryBuilderComponentSelector } from '../abstract';
import { All, Contains, Fragment, InsensitiveContains, Regex } from './';

export const SearchQuerySpec = (props: QueryBuilderProps) => (
  <QueryBuilderComponentSelector
    {...props}
    label="SearchQuerySpec"
    components={{
      All: All,
      Contains: Contains,
      Fragment: Fragment,
      InsensitiveContains: InsensitiveContains,
      Regex: Regex,
    }}
  />
);

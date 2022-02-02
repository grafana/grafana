import React from 'react';
import { PrometheusDatasource } from '../../datasource';
import { PromVisualQuery } from '../types';

export interface PromQueryBuilderContextType {
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
}

export const PromQueryBuilderContext = React.createContext<PromQueryBuilderContextType>(
  {} as any as PromQueryBuilderContextType
);

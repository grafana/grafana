import { ComponentType } from 'react';

import { QueryBuilderProps } from './types';

let QueryBuilderComponent: ComponentType<QueryBuilderProps> | null = null;

export function setQueryBuilderComponent(component: ComponentType<QueryBuilderProps>) {
  QueryBuilderComponent = component;
}

export function getQueryBuilderComponent(): ComponentType<QueryBuilderProps> {
  if (!QueryBuilderComponent) {
    throw new Error('QueryBuilder component not registered');
  }
  return QueryBuilderComponent;
}

import React from 'react';
import { QueryBuilderProps } from '../types';
import { QueryBuilderComponentSelector } from '../abstract';
import { Polygon, Radius, Rectangular } from './';

export const Bound = (props: QueryBuilderProps) => (
  <QueryBuilderComponentSelector
    {...props}
    label="Bound"
    components={{ Polygon: Polygon, Radius: Radius, Rectangular: Rectangular }}
  />
);

import { ComponentType } from 'react';
import { QueryBuilderProps } from '../types';

export interface QueryBuilderFieldProps extends QueryBuilderProps {
  name: string;
  label: string | undefined;
  description: string;
  onChange?: (newBuilder: any) => void;
}

export interface QueryComponent {
  queryType: string;
}

export interface Component {
  type: string;
}

export type QueryBuilderComponent<Type> = ComponentType<QueryBuilderProps> &
  Type & {
    fields: string[];
  };

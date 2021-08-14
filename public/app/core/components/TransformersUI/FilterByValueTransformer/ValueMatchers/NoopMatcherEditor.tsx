import { ValueMatcherID } from '@grafana/data';
import React from 'react';
import { ValueMatcherUIProps, ValueMatcherUIRegistryItem } from './types';

export const NoopMatcherEditor: React.FC<ValueMatcherUIProps<any>> = () => {
  return null;
};

export const getNoopValueMatchersUI = (): Array<ValueMatcherUIRegistryItem<any>> => {
  return [
    {
      name: 'Is null',
      id: ValueMatcherID.isNull,
      component: NoopMatcherEditor,
    },
    {
      name: 'Is not null',
      id: ValueMatcherID.isNotNull,
      component: NoopMatcherEditor,
    },
    {
      name: 'Is undefined',
      id: ValueMatcherID.isUndefined,
      component: NoopMatcherEditor,
    },
    {
      name: 'Is not undefined',
      id: ValueMatcherID.isNotUndefined,
      component: NoopMatcherEditor,
    },
  ];
};

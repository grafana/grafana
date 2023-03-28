import React from 'react';

import { ValueMatcherID } from '@grafana/data';

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
  ];
};

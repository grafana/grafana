import { ValueMatcherID } from '@grafana/data';

import { ValueMatcherUIRegistryItem } from './types';

export const NoopMatcherEditor = () => {
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

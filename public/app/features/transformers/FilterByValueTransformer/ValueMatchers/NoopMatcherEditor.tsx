import { ValueMatcherID } from '@grafana/data';

import { type ValueMatcherUIRegistryItem } from './types';

interface Props {}
const NoopMatcherEditor = (props: Props) => {
  return null;
};

export const getNoopValueMatchersUI = (): Array<ValueMatcherUIRegistryItem<Props>> => {
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

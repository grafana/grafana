import { Registry } from '@grafana/data';
import { getBasicValueMatchers } from './BasicMatcherEditor';
import { ValueMatcherUIRegistryItem } from './types';

export const valueMatchersUI = new Registry<ValueMatcherUIRegistryItem<any>>(() => {
  return [...getBasicValueMatchers()];
});

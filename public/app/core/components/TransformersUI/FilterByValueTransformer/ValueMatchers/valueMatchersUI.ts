import { Registry } from '@grafana/data';
import { getBasicValueMatchers } from './BasicMatcherEditor';
import { getNoopValueMatchers } from './NoopMatcherEditor';
import { ValueMatcherUIRegistryItem } from './types';

export const valueMatchersUI = new Registry<ValueMatcherUIRegistryItem<any>>(() => {
  return [...getBasicValueMatchers(), ...getNoopValueMatchers()];
});

import { Registry } from '@grafana/data';

import { getBasicValueMatchersUI } from './BasicMatcherEditor';
import { getNoopValueMatchersUI } from './NoopMatcherEditor';
import { getRangeValueMatchersUI } from './RangeMatcherEditor';
import { getRegexValueMatchersUI } from './RegexMatcherEditor';
import { ValueMatcherUIRegistryItem } from './types';

export const valueMatchersUI = new Registry<ValueMatcherUIRegistryItem<any>>(() => {
  return [
    ...getBasicValueMatchersUI(),
    ...getNoopValueMatchersUI(),
    ...getRangeValueMatchersUI(),
    ...getRegexValueMatchersUI(),
  ];
});

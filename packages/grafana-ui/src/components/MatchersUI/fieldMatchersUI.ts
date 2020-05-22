import { Registry } from '@grafana/data';
import { fieldNameMatcherItem } from './FieldNameMatcherEditor';
import { FieldMatcherUIRegistryItem } from './types';

export const fieldMatchersUI = new Registry<FieldMatcherUIRegistryItem<any>>(() => {
  return [fieldNameMatcherItem];
});

import { FieldMatcher } from '../../types';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from './ids';

export interface ReadOnlyFieldMatcherOptions<T = any> {
  innerId: FieldMatcherID;
  innerOptions: T;
  formattedValue: string;
}

const defaultMatcher: FieldMatcher = () => false;

fieldMatchers.register({
  id: FieldMatcherID.readOnly,
  name: 'Read-only field matcher',
  description: 'Field name by inner matcher',
  get: (options: ReadOnlyFieldMatcherOptions): FieldMatcher => {
    if (options.innerId === FieldMatcherID.readOnly) {
      throw new Error('You can not wrap the readOnly matcher in the readOnly matcher, will cause a loop.');
    }

    const matcher = fieldMatchers.getIfExists(options.innerId);

    if (!matcher) {
      return defaultMatcher;
    }

    return matcher.get(options.innerOptions);
  },
  getOptionsDisplayText: (options: ReadOnlyFieldMatcherOptions): string => {
    return `Fields matching ${options.formattedValue}.`;
  },
});

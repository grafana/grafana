import { FieldMatcher, FieldMatcherInfo } from '../../types';
import { Registry } from '../../utils';
import { FieldMatcherID } from './ids';

/**
 * @public
 */
export interface ReadOnlyFieldMatcherOptions<T = any> {
  innerId: FieldMatcherID;
  innerOptions: T;
  prefix: string;
}

/**
 * This field matcher is used as an decorator around any other
 * field matcher to indicate that it should be threated as read only
 * and its options can not be changed.
 *
 * @param registry containing all other field matchers
 * @public
 */
export const getReadOnlyFieldMatchers = (
  registry: Registry<FieldMatcherInfo>
): Array<FieldMatcherInfo<ReadOnlyFieldMatcherOptions>> => {
  return [
    {
      id: FieldMatcherID.readOnly,
      name: 'Read-only field matcher',
      description: 'Field name by inner matcher',
      excludeFromPicker: true,
      get: (options: ReadOnlyFieldMatcherOptions): FieldMatcher => {
        if (options.innerId === FieldMatcherID.readOnly) {
          throw new Error('You can not wrap the readOnly matcher in the readOnly matcher, will cause a loop.');
        }

        const matcher = registry.getIfExists(options.innerId);

        if (!matcher) {
          throw new Error(`Could not find given matcher Id ${options.innerId}`);
        }

        return matcher.get(options.innerOptions);
      },
      getOptionsDisplayText: (options: ReadOnlyFieldMatcherOptions): string => {
        const matcher = registry.getIfExists(options.innerId);

        if (!matcher) {
          throw new Error(`Could not find given matcher Id ${options.innerId}`);
        }

        if (!matcher.getOptionsDisplayText) {
          return '';
        }
        return matcher.getOptionsDisplayText(options);
      },
    },
  ];
};

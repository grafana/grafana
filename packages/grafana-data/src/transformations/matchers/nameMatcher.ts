import { Field, DataFrame } from '../../types/dataFrame';
import { FieldMatcherID, FrameMatcherID } from './ids';
import { FieldMatcherInfo, FrameMatcherInfo } from '../../types/transformations';
import { stringToJsRegex } from '../../text/string';
import { getFieldDisplayName } from '../../field/fieldState';

export interface FieldNameMatcherOptions {
  pattern: string;
  names?: string[];
}

const fieldNameMatcher: FieldMatcherInfo<FieldNameMatcherOptions> = {
  id: FieldMatcherID.byName,
  name: 'Field Name',
  description: 'match the field name',
  defaultOptions: {
    pattern: '/.*/',
  },

  get: (options: FieldNameMatcherOptions) => {
    const { pattern } = options;
    let regex = new RegExp('');
    try {
      regex = stringToJsRegex(pattern);
    } catch (e) {
      console.error(e);
    }
    return (field: Field, frame: DataFrame, allFrames: DataFrame[]) => {
      return regex.test(getFieldDisplayName(field, frame, allFrames) ?? '');
    };
  },

  getOptionsDisplayText: (options: FieldNameMatcherOptions) => {
    return `Field name: ${options.pattern}`;
  },
};

// General Field matcher
const frameNameMatcher: FrameMatcherInfo<string> = {
  id: FrameMatcherID.byName,
  name: 'Frame Name',
  description: 'match the frame name',
  defaultOptions: '/.*/',

  get: (pattern: string) => {
    const regex = stringToJsRegex(pattern);
    return (frame: DataFrame) => {
      return regex.test(frame.name || '');
    };
  },

  getOptionsDisplayText: (pattern: string) => {
    return `Frame name: ${pattern}`;
  },
};

/**
 * Registry Initalization
 */
export function getFieldNameMatchers(): FieldMatcherInfo[] {
  return [fieldNameMatcher];
}

export function getFrameNameMatchers(): FrameMatcherInfo[] {
  return [frameNameMatcher];
}

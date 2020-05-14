import { Field, DataFrame } from '../../types/dataFrame';
import { FieldMatcherID, FrameMatcherID } from './ids';
import { FieldMatcherInfo, FrameMatcherInfo } from '../../types/transformations';
import { stringToJsRegex } from '../../text/string';
import { getFieldDisplayName } from '../../field/fieldState';

export interface FieldNameMatcherOptions {
  pattern?: string;
  names?: string[];
}

const fieldNameMatcher: FieldMatcherInfo<FieldNameMatcherOptions> = {
  id: FieldMatcherID.byName,
  name: 'Field Name',
  description: 'match the field name',
  defaultOptions: {
    pattern: '/.*/',
    names: [],
  },

  get: (options: FieldNameMatcherOptions) => {
    const regex = patternToRegex(options.pattern);
    const matchByName = namesToRecord(options.names);

    return (field: Field, frame: DataFrame, allFrames: DataFrame[]) => {
      const displayName = getFieldDisplayName(field, frame, allFrames);
      if (matchByName[displayName]) {
        return true;
      }
      if (regex && regex.test(displayName)) {
        return true;
      }
      return false;
    };
  },

  getOptionsDisplayText: (options: FieldNameMatcherOptions) => {
    return `Field name: ${options.pattern}`;
  },
};

const patternToRegex = (pattern?: string): RegExp | undefined => {
  if (!pattern) {
    return undefined;
  }

  try {
    return stringToJsRegex(pattern);
  } catch (error) {
    console.log(error);
    return undefined;
  }
};

const namesToRecord = (names?: string[]): Record<string, boolean> => {
  if (!Array.isArray(names)) {
    return {};
  }
  return names.reduce((all, name) => {
    all[name] = true;
    return all;
  }, {} as Record<string, boolean>);
};

// General Frame matcher
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

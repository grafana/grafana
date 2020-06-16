import { Field, DataFrame } from '../../types/dataFrame';
import { FieldMatcherID, FrameMatcherID } from './ids';
import { FieldMatcherInfo, FrameMatcherInfo, FieldMatcher } from '../../types/transformations';
import { stringToJsRegex } from '../../text/string';
import { getFieldDisplayName } from '../../field/fieldState';

export interface RegexpOrNamesMatcherOptions {
  pattern?: string;
  names?: string[];
}

// General Field matcher
const fieldNameMatcher: FieldMatcherInfo<string> = {
  id: FieldMatcherID.byName,
  name: 'Field Name',
  description: 'match the field name',
  defaultOptions: '',

  get: (name: string): FieldMatcher => {
    return (field: Field, frame: DataFrame, allFrames: DataFrame[]) => {
      return getFieldDisplayName(field, frame, allFrames) === name;
    };
  },

  getOptionsDisplayText: (name: string) => {
    return `Field name: ${name}`;
  },
};

const multipleFieldNamesMatcher: FieldMatcherInfo<string[]> = {
  id: FieldMatcherID.byNames,
  name: 'Field Names',
  description: 'match any of the given the field names',
  defaultOptions: [],

  get: (names: string[]): FieldMatcher => {
    const uniqueNames = new Set<string>(names ?? []);

    return (field: Field, frame: DataFrame, allFrames: DataFrame[]) => {
      return uniqueNames.has(getFieldDisplayName(field, frame, allFrames));
    };
  },

  getOptionsDisplayText: (names: string[]): string => {
    return `Field names: ${names.join(', ')}`;
  },
};

const regexpFieldNameMatcher: FieldMatcherInfo<string> = {
  id: FieldMatcherID.byRegexp,
  name: 'Field Name by Regexp',
  description: 'match the field name by a given regexp pattern',
  defaultOptions: '/.*/',

  get: (pattern: string): FieldMatcher => {
    const regexp = patternToRegex(pattern);

    return (field: Field, frame: DataFrame, allFrames: DataFrame[]) => {
      const displayName = getFieldDisplayName(field, frame, allFrames);
      return !!regexp && regexp.test(displayName);
    };
  },

  getOptionsDisplayText: (pattern: string): string => {
    return `Field name by pattern: ${pattern}`;
  },
};

const regexpOrMultipleNamesMatcher: FieldMatcherInfo<RegexpOrNamesMatcherOptions> = {
  id: FieldMatcherID.byRegexpOrNames,
  name: 'Field Name by Regexp or Names',
  description: 'match the field name by a given regexp pattern or given names',
  defaultOptions: {
    pattern: '/.*/',
    names: [],
  },

  get: (options: RegexpOrNamesMatcherOptions): FieldMatcher => {
    const regexpMatcher = regexpFieldNameMatcher.get(options?.pattern || '');
    const namesMatcher = multipleFieldNamesMatcher.get(options?.names ?? []);

    return (field: Field, frame: DataFrame, allFrames: DataFrame[]) => {
      return namesMatcher(field, frame, allFrames) || regexpMatcher(field, frame, allFrames);
    };
  },

  getOptionsDisplayText: (options: RegexpOrNamesMatcherOptions): string => {
    const pattern = options?.pattern ?? '';
    const names = options?.names?.join(',') ?? '';
    return `Field name by pattern: ${pattern} or names: ${names}`;
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
 * Registry Initialization
 */
export function getFieldNameMatchers(): FieldMatcherInfo[] {
  return [fieldNameMatcher, regexpFieldNameMatcher, multipleFieldNamesMatcher, regexpOrMultipleNamesMatcher];
}

export function getFrameNameMatchers(): FrameMatcherInfo[] {
  return [frameNameMatcher];
}

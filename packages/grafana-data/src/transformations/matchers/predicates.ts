import { Field, DataFrame } from '../../types/dataFrame';
import { MatcherID } from './ids';
import { getFieldMatcher, fieldMatchers, getFrameMatchers, frameMatchers } from '../matchers';
import { FieldMatcherInfo, MatcherConfig, FrameMatcherInfo } from '../../types/transformations';

const anyFieldMatcher: FieldMatcherInfo<MatcherConfig[]> = {
  id: MatcherID.anyMatch,
  name: 'Any',
  description: 'Any child matches (OR)',
  excludeFromPicker: true,
  defaultOptions: [], // empty array

  get: (options: MatcherConfig[]) => {
    const children = options.map(option => {
      return getFieldMatcher(option);
    });
    return (field: Field) => {
      for (const child of children) {
        if (child(field)) {
          return true;
        }
      }
      return false;
    };
  },

  getOptionsDisplayText: (options: MatcherConfig[]) => {
    let text = '';
    for (const sub of options) {
      if (text.length > 0) {
        text += ' OR ';
      }
      const matcher = fieldMatchers.get(sub.id);
      text += matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(sub) : matcher.name;
    }
    return text;
  },
};

const anyFrameMatcher: FrameMatcherInfo<MatcherConfig[]> = {
  id: MatcherID.anyMatch,
  name: 'Any',
  description: 'Any child matches (OR)',
  excludeFromPicker: true,
  defaultOptions: [], // empty array

  get: (options: MatcherConfig[]) => {
    const children = options.map(option => {
      return getFrameMatchers(option);
    });
    return (frame: DataFrame) => {
      for (const child of children) {
        if (child(frame)) {
          return true;
        }
      }
      return false;
    };
  },

  getOptionsDisplayText: (options: MatcherConfig[]) => {
    let text = '';
    for (const sub of options) {
      if (text.length > 0) {
        text += ' OR ';
      }
      const matcher = frameMatchers.get(sub.id);
      text += matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(sub) : matcher.name;
    }
    return text;
  },
};

const allFieldsMatcher: FieldMatcherInfo<MatcherConfig[]> = {
  id: MatcherID.allMatch,
  name: 'All',
  description: 'Everything matches (AND)',
  excludeFromPicker: true,
  defaultOptions: [], // empty array

  get: (options: MatcherConfig[]) => {
    const children = options.map(option => {
      return getFieldMatcher(option);
    });
    return (field: Field) => {
      for (const child of children) {
        if (!child(field)) {
          return false;
        }
      }
      return true;
    };
  },

  getOptionsDisplayText: (options: MatcherConfig[]) => {
    let text = '';
    for (const sub of options) {
      if (text.length > 0) {
        text += ' AND ';
      }
      const matcher = fieldMatchers.get(sub.id); // Ugho what about frame
      text += matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(sub) : matcher.name;
    }
    return text;
  },
};

const allFramesMatcher: FrameMatcherInfo<MatcherConfig[]> = {
  id: MatcherID.allMatch,
  name: 'All',
  description: 'Everything matches (AND)',
  excludeFromPicker: true,
  defaultOptions: [], // empty array

  get: (options: MatcherConfig[]) => {
    const children = options.map(option => {
      return getFrameMatchers(option);
    });
    return (frame: DataFrame) => {
      for (const child of children) {
        if (!child(frame)) {
          return false;
        }
      }
      return true;
    };
  },

  getOptionsDisplayText: (options: MatcherConfig[]) => {
    let text = '';
    for (const sub of options) {
      if (text.length > 0) {
        text += ' AND ';
      }
      const matcher = frameMatchers.get(sub.id);
      text += matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(sub) : matcher.name;
    }
    return text;
  },
};

const notFieldMatcher: FieldMatcherInfo<MatcherConfig> = {
  id: MatcherID.invertMatch,
  name: 'NOT',
  description: 'Inverts other matchers',
  excludeFromPicker: true,

  get: (option: MatcherConfig) => {
    const check = getFieldMatcher(option);
    return (field: Field) => {
      return !check(field);
    };
  },

  getOptionsDisplayText: (options: MatcherConfig) => {
    const matcher = fieldMatchers.get(options.id);
    const text = matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(options.options) : matcher.name;
    return 'NOT ' + text;
  },
};

const notFrameMatcher: FrameMatcherInfo<MatcherConfig> = {
  id: MatcherID.invertMatch,
  name: 'NOT',
  description: 'Inverts other matchers',
  excludeFromPicker: true,

  get: (option: MatcherConfig) => {
    const check = getFrameMatchers(option);
    return (frame: DataFrame) => {
      return !check(frame);
    };
  },

  getOptionsDisplayText: (options: MatcherConfig) => {
    const matcher = frameMatchers.get(options.id);
    const text = matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(options.options) : matcher.name;
    return 'NOT ' + text;
  },
};

export const alwaysFieldMatcher = (field: Field) => {
  return true;
};

export const alwaysFrameMatcher = (frame: DataFrame) => {
  return true;
};

export const neverFieldMatcher = (field: Field) => {
  return false;
};

export const neverFrameMatcher = (frame: DataFrame) => {
  return false;
};

const alwaysFieldMatcherInfo: FieldMatcherInfo = {
  id: MatcherID.alwaysMatch,
  name: 'All Fields',
  description: 'Always Match',

  get: (option: any) => {
    return alwaysFieldMatcher;
  },

  getOptionsDisplayText: (options: any) => {
    return 'Always';
  },
};

const alwaysFrameMatcherInfo: FrameMatcherInfo = {
  id: MatcherID.alwaysMatch,
  name: 'All Frames',
  description: 'Always Match',

  get: (option: any) => {
    return alwaysFrameMatcher;
  },

  getOptionsDisplayText: (options: any) => {
    return 'Always';
  },
};

const neverFieldMatcherInfo: FieldMatcherInfo = {
  id: MatcherID.neverMatch,
  name: 'No Fields',
  description: 'Never Match',
  excludeFromPicker: true,

  get: (option: any) => {
    return neverFieldMatcher;
  },

  getOptionsDisplayText: (options: any) => {
    return 'Never';
  },
};

const neverFrameMatcherInfo: FrameMatcherInfo = {
  id: MatcherID.neverMatch,
  name: 'No Frames',
  description: 'Never Match',

  get: (option: any) => {
    return neverFrameMatcher;
  },

  getOptionsDisplayText: (options: any) => {
    return 'Never';
  },
};

export function getFieldPredicateMatchers(): FieldMatcherInfo[] {
  return [anyFieldMatcher, allFieldsMatcher, notFieldMatcher, alwaysFieldMatcherInfo, neverFieldMatcherInfo];
}

export function getFramePredicateMatchers(): FrameMatcherInfo[] {
  return [anyFrameMatcher, allFramesMatcher, notFrameMatcher, alwaysFrameMatcherInfo, neverFrameMatcherInfo];
}

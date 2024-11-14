import { stringStartsAsRegEx, stringToJsRegex } from '../../text/string';
import { DataFrame } from '../../types/dataFrame';
import { FrameMatcherInfo } from '../../types/transformations';

import { FrameMatcherID } from './ids';

// General Field matcher
const refIdMatcher: FrameMatcherInfo<string> = {
  id: FrameMatcherID.byRefId,
  name: 'Query refId',
  description: 'match the refId',
  defaultOptions: 'A',

  get: (pattern: string) => {
    let regex: RegExp | null = null;

    if (stringStartsAsRegEx(pattern)) {
      try {
        regex = stringToJsRegex(pattern);
      } catch (error) {
        if (error instanceof Error) {
          console.warn(error.message);
        }
      }
    }

    return (frame: DataFrame) => {
      return regex?.test(frame.refId || '') ?? frame.refId === pattern;
    };
  },

  getOptionsDisplayText: (pattern: string) => {
    return `RefID: ${pattern}`;
  },
};

export function getRefIdMatchers(): FrameMatcherInfo[] {
  return [refIdMatcher];
}

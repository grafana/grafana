import { stringToJsRegex } from '../../text';
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
    const regex = stringToJsRegex(pattern);
    return (frame: DataFrame) => {
      return regex.test(frame.refId || '');
    };
  },

  getOptionsDisplayText: (pattern: string) => {
    return `RefID: ${pattern}`;
  },
};

export function getRefIdMatchers(): FrameMatcherInfo[] {
  return [refIdMatcher];
}

import { DataFrame } from '../../types/dataFrame';
import { FrameMatcherInfo } from './matchers';
import { FrameMatcherID } from './ids';

// General Field matcher
const refIdMacher: FrameMatcherInfo<string> = {
  id: FrameMatcherID.byRefId,
  name: 'Query refId',
  description: 'match the refId',
  defaultOptions: 'A',

  get: (pattern: string) => {
    return (frame: DataFrame) => {
      return pattern === frame.refId;
    };
  },

  getOptionsDisplayText: (pattern: string) => {
    return `RefID: ${pattern}`;
  },
};

export function getRefIdMatchers(): FrameMatcherInfo[] {
  return [refIdMacher];
}

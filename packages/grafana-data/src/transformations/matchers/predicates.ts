import { type Field, type DataFrame, FieldType } from '../../types/dataFrame';
import { type FieldMatcherInfo, type FrameMatcherInfo } from '../../types/transformations';

import { MatcherID } from './ids';

export const alwaysFieldMatcher = (field: Field) => {
  return true;
};

const alwaysFrameMatcher = (frame: DataFrame) => {
  return true;
};

const neverFieldMatcher = (field: Field) => {
  return false;
};

export const notTimeFieldMatcher = (field: Field) => {
  return field.type !== FieldType.time;
};

const neverFrameMatcher = (frame: DataFrame) => {
  return false;
};

const alwaysFieldMatcherInfo: FieldMatcherInfo = {
  id: MatcherID.alwaysMatch,
  name: 'All Fields',
  description: 'Always Match',

  get: (_option) => {
    return alwaysFieldMatcher;
  },

  getOptionsDisplayText: (_options) => {
    return 'Always';
  },
};

const alwaysFrameMatcherInfo: FrameMatcherInfo = {
  id: MatcherID.alwaysMatch,
  name: 'All Frames',
  description: 'Always Match',

  get: (_option) => {
    return alwaysFrameMatcher;
  },

  getOptionsDisplayText: (_options) => {
    return 'Always';
  },
};

const neverFieldMatcherInfo: FieldMatcherInfo = {
  id: MatcherID.neverMatch,
  name: 'No Fields',
  description: 'Never Match',
  excludeFromPicker: true,

  get: (_option) => {
    return neverFieldMatcher;
  },

  getOptionsDisplayText: (_options) => {
    return 'Never';
  },
};

const neverFrameMatcherInfo: FrameMatcherInfo = {
  id: MatcherID.neverMatch,
  name: 'No Frames',
  description: 'Never Match',

  get: (_option) => {
    return neverFrameMatcher;
  },

  getOptionsDisplayText: (_options) => {
    return 'Never';
  },
};

export function getFieldPredicateMatchers(): FieldMatcherInfo[] {
  return [alwaysFieldMatcherInfo, neverFieldMatcherInfo];
}

export function getFramePredicateMatchers(): FrameMatcherInfo[] {
  return [alwaysFrameMatcherInfo, neverFrameMatcherInfo];
}

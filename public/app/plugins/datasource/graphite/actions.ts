import { GraphiteQueryEditorAngularDependencies, GraphiteSegment, GraphiteTag } from './types';

const init = (deps: GraphiteQueryEditorAngularDependencies) => ({
  type: 'INIT',
  payload: deps,
});

const getAltSegments = (segmentIndex: number, text: string) => ({
  type: 'GET_ALT_SEGMENTS',
  payload: {
    segmentIndex,
    text,
  },
});

const segmentValueChanged = (segment: GraphiteSegment, index: number) => ({
  type: 'SEGMENT_VALUE_CHANGED',
  payload: {
    segment,
    index,
  },
});

const getTags = (index: number, query: string) => ({
  type: 'GET_TAGS',
  payload: {
    index,
    query,
  },
});

const tagChanged = (tag: GraphiteTag, index: number) => ({
  type: 'TAG_CHANGED',
  payload: {
    tag,
    index,
  },
});

const getTagValues = (tag: GraphiteTag, index: number, query: string) => ({
  type: 'GET_TAG_VALUES',
  payload: {
    tag,
    index,
    query,
  },
});

const getTagOperators = () => ({
  type: 'GET_TAG_OPERATORS',
});

const getTagsAsSegments = (query: string) => ({
  type: 'GET_TAGS_AS_SEGMENTS',
  payload: {
    query,
  },
});

const addNewTag = (segment: GraphiteSegment) => ({
  type: 'ADD_NEW_TAG',
  payload: {
    segment,
  },
});

const unpause = () => ({
  type: 'UNPAUSE',
});

const addFunction = (name: string) => ({
  type: 'ADD_FUNCTION',
  payload: {
    name,
  },
});

const removeFunction = (funcDef: object) => ({
  type: 'REMOVE_FUNCTION',
  payload: {
    funcDef,
  },
});

const moveFunction = (funcDef: object, offset: number) => ({
  type: 'MOVE_FUNCTION',
  payload: {
    funcDef,
    offset,
  },
});

const targetChanged = () => ({
  type: 'TARGET_CHANGED',
});

const toggleEditorMode = () => ({
  type: 'TOGGLE_EDITOR',
});

export const actions = {
  init,
  getAltSegments,
  segmentValueChanged,
  getTags,
  tagChanged,
  getTagValues,
  getTagOperators,
  getTagsAsSegments,
  addNewTag,
  unpause,
  addFunction,
  removeFunction,
  moveFunction,
  targetChanged,
  toggleEditorMode,
};

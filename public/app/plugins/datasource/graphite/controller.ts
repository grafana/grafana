import GraphiteQuery from './graphite_query';
import { getTemplateSrv } from '@grafana/runtime';
import { GraphiteQueryEditorState } from './state';
import { GraphiteQueryEditorAngularDependencies, GraphiteTagOperator } from './types';
import {
  addSeriesByTagFunc,
  buildSegments,
  checkOtherSegments,
  emptySegments,
  fixTagSegments,
  parseTarget,
  pause,
  removeTagPrefix,
  setSegmentFocus,
  smartlyHandleNewAliasByNode,
  spliceSegments,
  updateModelTarget,
} from './helpers';

/**
 * All methods moved from Graphite's QueryCtrl
 */

export async function init(state: GraphiteQueryEditorState, deps: GraphiteQueryEditorAngularDependencies) {
  deps.target.target = deps.target.target || '';

  state = {
    ...state,
    ...deps,
    queryModel: new GraphiteQuery(deps.datasource, deps.target, getTemplateSrv()),
    supportsTags: deps.datasource.supportsTags,
    paused: false,
    removeTagValue: '-- remove tag --',
  };

  await state.datasource.waitForFuncDefsLoaded();
  state = await buildSegments(state, false);

  return state;
}

/**
 * Change the state between raw/visual editor and build segments (TODO: parsing can be done only when switching to visual editor)
 */
export async function toggleEditorMode(state: GraphiteQueryEditorState): Promise<GraphiteQueryEditorState> {
  state = { ...state };
  state.target.textEditor = !state.target.textEditor;
  state = await parseTarget(state);
  return state;
}

/**
 * Apply selected segment value.
 * Segments appearing after the current segment will be removed.
 */
export async function segmentValueChanged(
  state: GraphiteQueryEditorState,
  segment: { type: string; value: string; expandable: any },
  segmentIndex: number
): Promise<GraphiteQueryEditorState> {
  state = { ...state };

  state.error = null;
  state.queryModel.updateSegmentValue(segment, segmentIndex);

  // If segment changes and first function is fake then remove all functions
  // TODO: fake function is created when the first argument is not seriesList, for
  // example constantLine(number) - which seems to be broken now.
  if (state.queryModel.functions.length > 0 && state.queryModel.functions[0].def.fake) {
    state.queryModel.functions = [];
  }

  if (segment.type === 'tag') {
    const tag = removeTagPrefix(segment.value);
    state = pause(state);
    state = await addSeriesByTagFunc(state, tag);
    return state;
  }

  if (segment.expandable) {
    // TODO: return promiseToDigest(this.$scope)(
    state = await checkOtherSegments(state, segmentIndex + 1);
    state = setSegmentFocus(state, segmentIndex + 1);
    state = targetChanged(state);
    // );
  } else {
    state = spliceSegments(state, segmentIndex + 1);
  }

  state = setSegmentFocus(state, segmentIndex + 1);
  state = targetChanged(state);

  return state;
}

export function targetChanged(state: GraphiteQueryEditorState): GraphiteQueryEditorState {
  state = { ...state };

  if (state.queryModel.error) {
    return state;
  }

  const oldTarget = state.queryModel.target.target;
  state = updateModelTarget(state);

  if (state.queryModel.target !== oldTarget && !state.paused) {
    state.panelCtrl.refresh();
  }

  return state;
}

export async function addFunction(state: GraphiteQueryEditorState, funcDef: any): Promise<GraphiteQueryEditorState> {
  state = { ...state };

  const newFunc = state.datasource.createFuncInstance(funcDef, {
    withDefaultParams: true,
  });
  newFunc.added = true;
  state.queryModel.addFunction(newFunc);
  state = smartlyHandleNewAliasByNode(state, newFunc);

  if (state.segments.length === 1 && state.segments[0].fake) {
    state = emptySegments(state);
  }

  if (!newFunc.params.length && newFunc.added) {
    state = targetChanged(state);
  }

  if (newFunc.def.name === 'seriesByTag') {
    state = await parseTarget(state);
  }

  return state;
}

export function removeFunction(state: GraphiteQueryEditorState, func: any): GraphiteQueryEditorState {
  state = { ...state };

  state.queryModel.removeFunction(func);
  state = targetChanged(state);

  return state;
}

export function moveFunction(state: GraphiteQueryEditorState, func: any, offset: any): GraphiteQueryEditorState {
  state = { ...state };

  state.queryModel.moveFunction(func, offset);
  state = targetChanged(state);

  return state;
}

export function tagChanged(state: GraphiteQueryEditorState, tag: any, tagIndex: any): GraphiteQueryEditorState {
  state = { ...state };

  state.queryModel.updateTag(tag, tagIndex);
  state = targetChanged(state);

  return state;
}

export function addNewTag(state: GraphiteQueryEditorState, segment: { value: any }): GraphiteQueryEditorState {
  state = { ...state };

  const newTagKey = segment.value;
  const newTag = { key: newTagKey, operator: '=' as GraphiteTagOperator, value: '' };
  state.queryModel.addTag(newTag);
  state = targetChanged(state);
  state = fixTagSegments(state);

  return state;
}

export function unpause(state: GraphiteQueryEditorState): GraphiteQueryEditorState {
  state = { ...state };

  state.paused = false;
  state.panelCtrl.refresh();

  return state;
}

const controller = {
  init,
};

export default controller;

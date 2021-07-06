import GraphiteQuery from './graphite_query';
import { getTemplateSrv } from '@grafana/runtime';
import { each, map } from 'lodash';
import { GraphiteQueryEditorState } from './state';
import { GraphiteQueryEditorAngularDependencies, GraphiteTagOperator } from './types';
import { handleMetricsAutoCompleteError, TAG_PREFIX } from './common';

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

// TODO: move to util.ts

/**
 * Create new AST based on new query.
 * Build segments from parsed metric name and functions.
 */
async function parseTarget(state: GraphiteQueryEditorState): Promise<GraphiteQueryEditorState> {
  state = { ...state };
  state.queryModel.parseTarget();
  state = await buildSegments(state);
  return state;
}

/**
 * Create segments out of the current metric path + add "select metrics" if it's possible to add more to the path
 */
async function buildSegments(state: GraphiteQueryEditorState, modifyLastSegment = true) {
  state = { ...state };

  state.segments = map(state.queryModel.segments, (segment) => {
    return state.uiSegmentSrv.newSegment(segment);
  });

  const checkOtherSegmentsIndex = state.queryModel.checkOtherSegmentsIndex || 0;

  state = await checkOtherSegments(state, checkOtherSegmentsIndex, modifyLastSegment);

  if (state.queryModel.seriesByTagUsed) {
    state = fixTagSegments(state);
  }

  return state;
}

/**
 * Add "select metric" segment at the end
 */
function addSelectMetricSegment(state: GraphiteQueryEditorState): GraphiteQueryEditorState {
  state = { ...state };
  state.queryModel.addSelectMetricSegment();
  state.segments.push(state.uiSegmentSrv.newSelectMetric());
  return state;
}

/**
 * Check if it's possible to add more metrics at the end of the metric name and add it.
 */
async function checkOtherSegments(
  state: GraphiteQueryEditorState,
  fromIndex: number,
  modifyLastSegment = true
): Promise<GraphiteQueryEditorState> {
  state = { ...state };

  if (state.queryModel.segments.length === 1 && state.queryModel.segments[0].type === 'series-ref') {
    return state;
  }

  if (fromIndex === 0) {
    state = addSelectMetricSegment(state);
    return state;
  }

  const path = state.queryModel.getSegmentPathUpTo(fromIndex + 1);
  if (path === '') {
    return state;
  }

  try {
    const segments = await state.datasource.metricFindQuery(path);
    if (segments.length === 0) {
      if (path !== '' && modifyLastSegment) {
        state.queryModel.segments = state.queryModel.segments.splice(0, fromIndex);
        state.segments = state.segments.splice(0, fromIndex);
        state = addSelectMetricSegment(state);
      }
    } else if (segments[0].expandable) {
      if (state.segments.length === fromIndex) {
        state = addSelectMetricSegment(state);
      } else {
        state = await checkOtherSegments(state, fromIndex + 1);
      }
    }
  } catch (err) {
    state = handleMetricsAutoCompleteError(state, err);
  }

  return state;
}

/**
 * Changes segment being in focus. After changing the value, next segment gets focus.
 *
 * Note: It's a bit hidden feature. After selecting one metric, and pressing down arrow the dropdown can be expanded.
 * But there's nothing indicating what's in focus and how to expand the dropdown;
 */
function setSegmentFocus(state: GraphiteQueryEditorState, segmentIndex: any): GraphiteQueryEditorState {
  state = { ...state };
  each(state.segments, (segment, index) => {
    segment.focus = segmentIndex === index;
  });
  return state;
}

function spliceSegments(state: GraphiteQueryEditorState, index: any): GraphiteQueryEditorState {
  state = { ...state };

  state.segments = state.segments.splice(0, index);
  state.queryModel.segments = state.queryModel.segments.splice(0, index);

  return state;
}

function emptySegments(state: GraphiteQueryEditorState): GraphiteQueryEditorState {
  state = { ...state };

  state.queryModel.segments = [];
  state.segments = [];

  return state;
}

function updateModelTarget(state: GraphiteQueryEditorState): GraphiteQueryEditorState {
  state = { ...state };

  state.queryModel.updateModelTarget(state.panelCtrl.panel.targets);

  return state;
}

async function addSeriesByTagFunc(state: GraphiteQueryEditorState, tag: string): Promise<GraphiteQueryEditorState> {
  state = { ...state };

  const newFunc = state.datasource.createFuncInstance('seriesByTag', {
    withDefaultParams: false,
  });
  const tagParam = `${tag}=`;
  newFunc.params = [tagParam];
  state.queryModel.addFunction(newFunc);
  newFunc.added = true;

  state = emptySegments(state);
  state = targetChanged(state);
  state = await parseTarget(state);

  return state;
}

function smartlyHandleNewAliasByNode(
  state: GraphiteQueryEditorState,
  func: { def: { name: string }; params: number[]; added: boolean }
): GraphiteQueryEditorState {
  state = { ...state };

  if (func.def.name !== 'aliasByNode') {
    return state;
  }

  for (let i = 0; i < state.segments.length; i++) {
    if (state.segments[i].value.indexOf('*') >= 0) {
      func.params[0] = i;
      func.added = false;
      state = targetChanged(state);
      return state;
    }
  }

  return state;
}

function fixTagSegments(state: GraphiteQueryEditorState): GraphiteQueryEditorState {
  state = { ...state };

  // Adding tag with the same name as just removed works incorrectly if single segment is used (instead of array)
  state.addTagSegments = [state.uiSegmentSrv.newPlusButton()];

  return state;
}

function pause(state: GraphiteQueryEditorState): GraphiteQueryEditorState {
  return {
    ...state,
    paused: true,
  };
}

function removeTagPrefix(value: string): string {
  return value.replace(TAG_PREFIX, '');
}

const controller = {
  init,
};

export default controller;

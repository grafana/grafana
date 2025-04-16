import { clone, some } from 'lodash';

import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import { FuncInstance } from '../gfunc';
import { GraphiteTagOperator } from '../types';

import { GraphiteQueryEditorState } from './store';

/**
 * Helpers used by reducers and providers. They modify state object directly so should operate on a copy of the state.
 */

export const GRAPHITE_TAG_OPERATORS: GraphiteTagOperator[] = ['=', '!=', '=~', '!=~'];

/**
 * Tag names and metric names are displayed in a single dropdown. This prefix is used to
 * distinguish both in the UI.
 */
export const TAG_PREFIX = 'tag: ';

/**
 * Create new AST based on new query.
 * Build segments from parsed metric name and functions.
 */
export async function parseTarget(state: GraphiteQueryEditorState): Promise<void> {
  state.queryModel.parseTarget();
  await buildSegments(state);
}

/**
 * Create segments out of the current metric path + add "select metrics" if it's possible to add more to the path
 */
export async function buildSegments(state: GraphiteQueryEditorState, modifyLastSegment = true): Promise<void> {
  // Start with a shallow copy from the model, then check if "select metric" segment should be added at the end
  state.segments = clone(state.queryModel.segments);

  const checkOtherSegmentsIndex = state.queryModel.checkOtherSegmentsIndex || 0;

  await checkOtherSegments(state, checkOtherSegmentsIndex, modifyLastSegment);
}

/**
 * Add "select metric" segment at the end
 */
export function addSelectMetricSegment(state: GraphiteQueryEditorState): void {
  state.queryModel.addSelectMetricSegment();
  state.segments.push({ value: 'select metric', fake: true });
}

/**
 * Validates the state after adding or changing a segment:
 * - adds "select metric" only when more segments can be added to the metric name
 * - check if subsequent segments are still valid if in-between segment changes and
 *   removes invalid segments.
 */
export async function checkOtherSegments(
  state: GraphiteQueryEditorState,
  fromIndex: number,
  modifyLastSegment = true
): Promise<void> {
  if (state.queryModel.segments.length === 1 && state.queryModel.segments[0].type === 'series-ref') {
    return;
  }

  if (fromIndex === 0) {
    addSelectMetricSegment(state);
    return;
  }

  const currentFromIndex = fromIndex + 1;
  const path = state.queryModel.getSegmentPathUpTo(currentFromIndex);
  if (path === '') {
    return;
  }

  try {
    const segments = await state.datasource.metricFindQuery(path);
    if (segments.length === 0) {
      if (path !== '' && modifyLastSegment) {
        state.queryModel.segments = state.queryModel.segments.splice(0, currentFromIndex);
        state.segments = state.segments.splice(0, currentFromIndex);
        if (!some(state.segments, { fake: true })) {
          addSelectMetricSegment(state);
        }
      }
    } else if (segments[0].expandable) {
      if (state.segments.length === fromIndex) {
        addSelectMetricSegment(state);
      } else {
        await checkOtherSegments(state, currentFromIndex);
      }
    }
  } catch (err) {
    if (err instanceof Error) {
      handleMetricsAutoCompleteError(state, err);
    }
  }
}

export function spliceSegments(state: GraphiteQueryEditorState, index: number): void {
  state.segments = state.segments.splice(0, index);
  state.queryModel.segments = state.queryModel.segments.splice(0, index);
}

export function emptySegments(state: GraphiteQueryEditorState): void {
  state.queryModel.segments = [];
  state.segments = [];
}

/**
 * When seriesByTag function is added the UI changes it's state and only tags can be added from now.
 */
export async function addSeriesByTagFunc(state: GraphiteQueryEditorState, tag: string): Promise<void> {
  const newFunc = state.datasource.createFuncInstance('seriesByTag', {
    withDefaultParams: false,
  });
  const tagParam = `${tag}=`;
  newFunc.params = [tagParam];
  state.queryModel.addFunction(newFunc);
  newFunc.added = true;

  emptySegments(state);
  handleTargetChanged(state);
  await parseTarget(state);
}

export function smartlyHandleNewAliasByNode(state: GraphiteQueryEditorState, func: FuncInstance): void {
  if (func.def.name !== 'aliasByNode') {
    return;
  }

  for (let i = 0; i < state.segments.length; i++) {
    if (state.segments[i].value.indexOf('*') >= 0) {
      func.params[0] = i;
      func.added = false;
      handleTargetChanged(state);
      return;
    }
  }
}

/**
 * Pauses running the query to allow selecting tag value. This is to prevent getting errors if the query is run
 * for a tag with no selected value.
 */
export function pause(state: GraphiteQueryEditorState): void {
  state.paused = true;
}

export function removeTagPrefix(value: string): string {
  return value.replace(TAG_PREFIX, '');
}

export function handleTargetChanged(state: GraphiteQueryEditorState): void {
  if (state.queryModel.error) {
    return;
  }

  const oldResolvedTarget = state.queryModel.target.targetFull ?? state.queryModel.target.target;
  const oldTargetRemovedSpaces = oldResolvedTarget.replace(/\s+/g, '');
  // Interpolate from other queries:
  // Because of mixed data sources the list may contain queries for non-Graphite data sources. To ensure a valid query
  // is used for interpolation we should check required properties are passed though in theory it allows to interpolate
  // with queries that contain "target" property as well.
  state.queryModel.updateModelTarget(
    (state.queries || []).filter((query) => 'target' in query && typeof query.target === 'string')
  );

  const newResolvedTarget = state.queryModel.target.targetFull ?? state.queryModel.target.target;
  const newTargetRemovedSpaces = newResolvedTarget.replace(/\s+/g, '');

  if (newTargetRemovedSpaces !== oldTargetRemovedSpaces && !state.paused) {
    state.refresh();
  }
}

/**
 * When metrics autocomplete fails - the error is shown, but only once per page view
 */
export function handleMetricsAutoCompleteError(
  state: GraphiteQueryEditorState,
  error: Error
): GraphiteQueryEditorState {
  if (!state.metricAutoCompleteErrorShown) {
    state.metricAutoCompleteErrorShown = true;
    dispatch(notifyApp(createErrorNotification(`Fetching metrics failed: ${error.message}.`)));
  }
  return state;
}

/**
 * When tags autocomplete fails - the error is shown, but only once per page view
 */
export function handleTagsAutoCompleteError(state: GraphiteQueryEditorState, error: Error): GraphiteQueryEditorState {
  if (!state.tagsAutoCompleteErrorShown) {
    state.tagsAutoCompleteErrorShown = true;
    dispatch(notifyApp(createErrorNotification(`Fetching tags failed: ${error.message}.`)));
  }
  return state;
}

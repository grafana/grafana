import { GraphiteQueryEditorState } from './state';
import { each, map } from 'lodash';
import { dispatch } from '../../../../store/store';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { createErrorNotification } from '../../../../core/copy/appNotification';

export const GRAPHITE_TAG_OPERATORS = ['=', '!=', '=~', '!=~'];

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
  state.segments = map(state.queryModel.segments, (segment) => {
    return state.uiSegmentSrv.newSegment(segment);
  });

  const checkOtherSegmentsIndex = state.queryModel.checkOtherSegmentsIndex || 0;

  await checkOtherSegments(state, checkOtherSegmentsIndex, modifyLastSegment);

  if (state.queryModel.seriesByTagUsed) {
    fixTagSegments(state);
  }
}

/**
 * Add "select metric" segment at the end
 */
export function addSelectMetricSegment(state: GraphiteQueryEditorState): void {
  state.queryModel.addSelectMetricSegment();
  state.segments.push(state.uiSegmentSrv.newSelectMetric());
}

/**
 * Check if it's possible to add more metrics at the end of the metric name and add it.
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

  const path = state.queryModel.getSegmentPathUpTo(fromIndex + 1);
  if (path === '') {
    return;
  }

  try {
    const segments = await state.datasource.metricFindQuery(path);
    if (segments.length === 0) {
      if (path !== '' && modifyLastSegment) {
        state.queryModel.segments = state.queryModel.segments.splice(0, fromIndex);
        state.segments = state.segments.splice(0, fromIndex);
        addSelectMetricSegment(state);
      }
    } else if (segments[0].expandable) {
      if (state.segments.length === fromIndex) {
        addSelectMetricSegment(state);
      } else {
        await checkOtherSegments(state, fromIndex + 1);
      }
    }
  } catch (err) {
    handleMetricsAutoCompleteError(state, err);
  }
}

/**
 * Changes segment being in focus. After changing the value, next segment gets focus.
 *
 * Note: It's a bit hidden feature. After selecting one metric, and pressing down arrow the dropdown can be expanded.
 * But there's nothing indicating what's in focus and how to expand the dropdown;
 */
export function setSegmentFocus(state: GraphiteQueryEditorState, segmentIndex: any): void {
  each(state.segments, (segment, index) => {
    segment.focus = segmentIndex === index;
  });
}

export function spliceSegments(state: GraphiteQueryEditorState, index: any): void {
  state.segments = state.segments.splice(0, index);
  state.queryModel.segments = state.queryModel.segments.splice(0, index);
}

export function emptySegments(state: GraphiteQueryEditorState): void {
  state.queryModel.segments = [];
  state.segments = [];
}

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

export function smartlyHandleNewAliasByNode(
  state: GraphiteQueryEditorState,
  func: { def: { name: string }; params: number[]; added: boolean }
): void {
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

export function fixTagSegments(state: GraphiteQueryEditorState): void {
  // Adding tag with the same name as just removed works incorrectly if single segment is used (instead of array)
  state.addTagSegments = [state.uiSegmentSrv.newPlusButton()];
}

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

  const oldTarget = state.queryModel.target.target;
  state.queryModel.updateModelTarget(state.panelCtrl.panel.targets);

  if (state.queryModel.target !== oldTarget && !state.paused) {
    state.panelCtrl.refresh();
  }
}

/**
 * When metrics autocomplete fails - the error is shown, by only once per page view
 */
export function handleMetricsAutoCompleteError(
  state: GraphiteQueryEditorState,
  error: Error
): GraphiteQueryEditorState {
  console.error(error);
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
  console.error(error);
  if (!state.tagsAutoCompleteErrorShown) {
    state.tagsAutoCompleteErrorShown = true;
    dispatch(notifyApp(createErrorNotification(`Fetching tags failed: ${error.message}.`)));
  }
  return state;
}

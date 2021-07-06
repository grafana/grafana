import { GraphiteQueryEditorState } from './state';
import { each, map } from 'lodash';
import { handleMetricsAutoCompleteError, TAG_PREFIX } from './common';
import { targetChanged } from './controller';

/**
 * Create new AST based on new query.
 * Build segments from parsed metric name and functions.
 */
export async function parseTarget(state: GraphiteQueryEditorState): Promise<GraphiteQueryEditorState> {
  state = { ...state };
  state.queryModel.parseTarget();
  state = await buildSegments(state);
  return state;
}

/**
 * Create segments out of the current metric path + add "select metrics" if it's possible to add more to the path
 */
export async function buildSegments(state: GraphiteQueryEditorState, modifyLastSegment = true) {
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
export function addSelectMetricSegment(state: GraphiteQueryEditorState): GraphiteQueryEditorState {
  state = { ...state };
  state.queryModel.addSelectMetricSegment();
  state.segments.push(state.uiSegmentSrv.newSelectMetric());
  return state;
}

/**
 * Check if it's possible to add more metrics at the end of the metric name and add it.
 */
export async function checkOtherSegments(
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
export function setSegmentFocus(state: GraphiteQueryEditorState, segmentIndex: any): GraphiteQueryEditorState {
  state = { ...state };
  each(state.segments, (segment, index) => {
    segment.focus = segmentIndex === index;
  });
  return state;
}

export function spliceSegments(state: GraphiteQueryEditorState, index: any): GraphiteQueryEditorState {
  state = { ...state };

  state.segments = state.segments.splice(0, index);
  state.queryModel.segments = state.queryModel.segments.splice(0, index);

  return state;
}

export function emptySegments(state: GraphiteQueryEditorState): GraphiteQueryEditorState {
  state = { ...state };

  state.queryModel.segments = [];
  state.segments = [];

  return state;
}

export function updateModelTarget(state: GraphiteQueryEditorState): GraphiteQueryEditorState {
  state = { ...state };

  state.queryModel.updateModelTarget(state.panelCtrl.panel.targets);

  return state;
}

export async function addSeriesByTagFunc(
  state: GraphiteQueryEditorState,
  tag: string
): Promise<GraphiteQueryEditorState> {
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

export function smartlyHandleNewAliasByNode(
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

export function fixTagSegments(state: GraphiteQueryEditorState): GraphiteQueryEditorState {
  state = { ...state };

  // Adding tag with the same name as just removed works incorrectly if single segment is used (instead of array)
  state.addTagSegments = [state.uiSegmentSrv.newPlusButton()];

  return state;
}

export function pause(state: GraphiteQueryEditorState): GraphiteQueryEditorState {
  return {
    ...state,
    paused: true,
  };
}

export function removeTagPrefix(value: string): string {
  return value.replace(TAG_PREFIX, '');
}

import GraphiteQuery from './graphite_query';
import { getTemplateSrv } from '@grafana/runtime';
import _ from 'lodash';
import { dispatch } from '../../../store/store';
import { notifyApp } from '../../../core/reducers/appNotification';
import { createErrorNotification } from '../../../core/copy/appNotification';
import { GraphiteQueryEditorState } from './state';
import { GraphiteQueryEditorAngularDependencies } from './types';

const GRAPHITE_TAG_OPERATORS = ['=', '!=', '=~', '!=~'];
const TAG_PREFIX = 'tag: ';

/**
 * XXX: Work in progress.
 *
 * All methods are made async and as close to original QueryCtrl methods. This was done on purpose to simplify migration
 * from QueryCtrl and will be reviewed after the migration is over.
 *
 * TODO:
 * [ ] - review async methods and check if they can be made sync
 * [ ] - review naming conventions
 * [ ] - simplify implementation once the editor is migrated to React
 * [ ] - split methods into: metrics/tags/functions
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

async function parseTarget(state: GraphiteQueryEditorState) {
  state = { ...state };
  state.queryModel.parseTarget();
  state = await buildSegments(state);
  return state;
}

export async function toggleEditorMode(state: GraphiteQueryEditorState) {
  state = { ...state };
  state.target.textEditor = !state.target.textEditor;
  state = await parseTarget(state);
  return state;
}

async function buildSegments(state: GraphiteQueryEditorState, modifyLastSegment = true) {
  state = { ...state };

  state.segments = _.map(state.queryModel.segments, (segment) => {
    return state.uiSegmentSrv.newSegment(segment);
  });

  const checkOtherSegmentsIndex = state.queryModel.checkOtherSegmentsIndex || 0;

  state = await checkOtherSegments(state, checkOtherSegmentsIndex, modifyLastSegment);

  if (state.queryModel.seriesByTagUsed) {
    state = await fixTagSegments(state);
  }

  return state;
}

async function addSelectMetricSegment(state: GraphiteQueryEditorState): Promise<GraphiteQueryEditorState> {
  state = { ...state };
  state.queryModel.addSelectMetricSegment();
  state.segments.push(state.uiSegmentSrv.newSelectMetric());
  return state;
}

async function checkOtherSegments(state: GraphiteQueryEditorState, fromIndex: number, modifyLastSegment = true) {
  state = { ...state };

  if (state.queryModel.segments.length === 1 && state.queryModel.segments[0].type === 'series-ref') {
    return state;
  }

  if (fromIndex === 0) {
    state = await addSelectMetricSegment(state);
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
        state = await addSelectMetricSegment(state);
      }
    } else if (segments[0].expandable) {
      if (state.segments.length === fromIndex) {
        state = await addSelectMetricSegment(state);
      } else {
        state = await checkOtherSegments(state, fromIndex + 1);
      }
    }
  } catch (err) {
    state = await handleMetricsAutoCompleteError(state, err);
  }

  return state;
}

async function setSegmentFocus(state: GraphiteQueryEditorState, segmentIndex: any) {
  state = { ...state };
  _.each(state.segments, (segment, index) => {
    segment.focus = segmentIndex === index;
  });
  return state;
}

// TODO: UI fetch every time a segment is opened, not only once
export async function getAltSegments(
  state: GraphiteQueryEditorState,
  index: number,
  prefix: string
): Promise<GraphiteQueryEditorState> {
  state = { ...state };

  let query = prefix && prefix.length > 0 ? '*' + prefix + '*' : '*';
  if (index > 0) {
    query = state.queryModel.getSegmentPathUpTo(index) + '.' + query;
  }
  const options = {
    range: state.panelCtrl.range,
    requestId: 'get-alt-segments',
  };

  try {
    const segments = await state.datasource.metricFindQuery(query, options);
    const altSegments = _.map(segments, (segment) => {
      return state.uiSegmentSrv.newSegment({
        value: segment.text,
        expandable: segment.expandable,
      });
    });

    if (index > 0 && altSegments.length === 0) {
      // state.altSegments = altSegments;
      // return state;
      return {
        ...state,
        altSegments,
      };
    }

    // add query references
    if (index === 0) {
      _.eachRight(state.panelCtrl.panel.targets, (target) => {
        if (target.refId === state.queryModel.target.refId) {
          return;
        }

        altSegments.unshift(
          state.uiSegmentSrv.newSegment({
            type: 'series-ref',
            value: '#' + target.refId,
            expandable: false,
          })
        );
      });
    }

    // add template variables
    _.eachRight(state.templateSrv.getVariables(), (variable) => {
      altSegments.unshift(
        state.uiSegmentSrv.newSegment({
          type: 'template',
          value: '$' + variable.name,
          expandable: true,
        })
      );
    });

    // add wildcard option
    altSegments.unshift(state.uiSegmentSrv.newSegment('*'));

    if (state.supportsTags && index === 0) {
      removeTaggedEntry(altSegments);
      state = await addAltTagSegments(state, prefix, altSegments);
    } else {
      return {
        ...state,
        altSegments,
      };
    }
  } catch (err) {
    state = await handleMetricsAutoCompleteError(state, err);
    state.altSegments = [];
  }

  return state;
}

async function addAltTagSegments(
  state: GraphiteQueryEditorState,
  prefix: string,
  altSegments: any[]
): Promise<GraphiteQueryEditorState> {
  state = { ...state };
  state = await getTagsAsSegments(state, prefix);

  state.tagSegments = _.map(state.tagsAsSegments, (segment) => {
    segment.value = TAG_PREFIX + segment.value;
    return segment;
  });

  state.altSegments = altSegments.concat(...state.tagSegments);
  return state;
}

function removeTaggedEntry(altSegments: any[]) {
  _.remove(altSegments, (s) => s.value === '_tagged');
}

export async function segmentValueChanged(
  state: GraphiteQueryEditorState,
  segment: { type: string; value: string; expandable: any },
  segmentIndex: number
): Promise<GraphiteQueryEditorState> {
  state = { ...state };

  state.error = null;
  state.queryModel.updateSegmentValue(segment, segmentIndex);

  if (state.queryModel.functions.length > 0 && state.queryModel.functions[0].def.fake) {
    state.queryModel.functions = [];
  }

  if (segment.type === 'tag') {
    const tag = removeTagPrefix(segment.value);
    state = await pause(state);
    state = await addSeriesByTagFunc(state, tag);
    return state;
  }

  if (segment.expandable) {
    // return promiseToDigest(this.$scope)(
    state = await checkOtherSegments(state, segmentIndex + 1);
    state = await setSegmentFocus(state, segmentIndex + 1);
    state = await targetChanged(state);
    // );
  } else {
    state = await spliceSegments(state, segmentIndex + 1);
  }

  state = await setSegmentFocus(state, segmentIndex + 1);
  state = await targetChanged(state);

  return state;
}

async function spliceSegments(state: GraphiteQueryEditorState, index: any): Promise<GraphiteQueryEditorState> {
  state = { ...state };

  state.segments = state.segments.splice(0, index);
  state.queryModel.segments = state.queryModel.segments.splice(0, index);

  return state;
}

async function emptySegments(state: GraphiteQueryEditorState): Promise<GraphiteQueryEditorState> {
  state = { ...state };

  state.queryModel.segments = [];
  state.segments = [];

  return state;
}

async function updateModelTarget(state: GraphiteQueryEditorState): Promise<GraphiteQueryEditorState> {
  state = { ...state };

  state.queryModel.updateModelTarget(state.panelCtrl.panel.targets);

  return state;
}

export async function targetChanged(state: GraphiteQueryEditorState): Promise<GraphiteQueryEditorState> {
  if (state.queryModel.error) {
    return state;
  }

  const oldTarget = state.queryModel.target.target;
  state = await updateModelTarget(state);

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
  state = await smartlyHandleNewAliasByNode(state, newFunc);

  if (state.segments.length === 1 && state.segments[0].fake) {
    state = await emptySegments(state);
  }

  if (!newFunc.params.length && newFunc.added) {
    state = await targetChanged(state);
  }

  if (newFunc.def.name === 'seriesByTag') {
    state = await parseTarget(state);
  }

  return state;
}

export async function removeFunction(state: GraphiteQueryEditorState, func: any): Promise<GraphiteQueryEditorState> {
  state = { ...state };

  state.queryModel.removeFunction(func);
  state = await targetChanged(state);

  return state;
}

export async function moveFunction(
  state: GraphiteQueryEditorState,
  func: any,
  offset: any
): Promise<GraphiteQueryEditorState> {
  state = { ...state };

  state.queryModel.moveFunction(func, offset);
  state = await targetChanged(state);

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

  state = await emptySegments(state);
  state = await targetChanged(state);
  state = await parseTarget(state);

  return state;
}

async function smartlyHandleNewAliasByNode(
  state: GraphiteQueryEditorState,
  func: { def: { name: string }; params: number[]; added: boolean }
): Promise<GraphiteQueryEditorState> {
  state = { ...state };

  if (func.def.name !== 'aliasByNode') {
    return state;
  }

  for (let i = 0; i < state.segments.length; i++) {
    if (state.segments[i].value.indexOf('*') >= 0) {
      func.params[0] = i;
      func.added = false;
      state = await targetChanged(state);
      return state;
    }
  }

  return state;
}

export async function getTags(
  state: GraphiteQueryEditorState,
  index: number,
  tagPrefix: any
): Promise<GraphiteQueryEditorState> {
  state = { ...state };

  try {
    const tagExpressions = state.queryModel.renderTagExpressions(index);
    const values = await state.datasource.getTagsAutoComplete(tagExpressions, tagPrefix);

    const altTags = _.map(values, 'text');
    altTags.splice(0, 0, state.removeTagValue);
    state.allTags = mapToDropdownOptions(altTags);
  } catch (err) {
    state = await handleTagsAutoCompleteError(state, err);
  }

  return state;
}

export async function getTagsAsSegments(
  state: GraphiteQueryEditorState,
  tagPrefix: string
): Promise<GraphiteQueryEditorState> {
  state = { ...state };

  try {
    const tagExpressions = state.queryModel.renderTagExpressions();
    const values = await state.datasource.getTagsAutoComplete(tagExpressions, tagPrefix);
    state.tagsAsSegments = _.map(values, (val) => {
      return state.uiSegmentSrv.newSegment({
        value: val.text,
        type: 'tag',
        expandable: false,
      });
    });
  } catch (err) {
    state.tagsAsSegments = [];
    state = await handleTagsAutoCompleteError(state, err);
  }

  return state;
}

export async function getTagOperators(state: GraphiteQueryEditorState): Promise<GraphiteQueryEditorState> {
  return {
    ...state,
    tagOperators: mapToDropdownOptions(GRAPHITE_TAG_OPERATORS),
  };
}

export async function getTagValues(
  state: GraphiteQueryEditorState,
  tag: { key: any },
  index: number,
  valuePrefix: any
): Promise<GraphiteQueryEditorState> {
  state = { ...state };

  const tagExpressions = state.queryModel.renderTagExpressions(index);
  const tagKey = tag.key;
  const values = await state.datasource.getTagValuesAutoComplete(tagExpressions, tagKey, valuePrefix, {});
  const altValues = _.map(values, 'text');
  // Add template variables as additional values
  _.eachRight(state.templateSrv.getVariables(), (variable) => {
    altValues.push('${' + variable.name + ':regex}');
  });

  state.tagValues = mapToDropdownOptions(altValues);
  return state;
}

export async function tagChanged(
  state: GraphiteQueryEditorState,
  tag: any,
  tagIndex: any
): Promise<GraphiteQueryEditorState> {
  state = { ...state };

  state.queryModel.updateTag(tag, tagIndex);
  state = await targetChanged(state);

  return state;
}

export async function addNewTag(
  state: GraphiteQueryEditorState,
  segment: { value: any }
): Promise<GraphiteQueryEditorState> {
  state = { ...state };

  const newTagKey = segment.value;
  const newTag = { key: newTagKey, operator: '=', value: '' };
  state.queryModel.addTag(newTag);
  state = await targetChanged(state);
  state = await fixTagSegments(state);

  return state;
}

async function fixTagSegments(state: GraphiteQueryEditorState): Promise<GraphiteQueryEditorState> {
  state = { ...state };

  // Adding tag with the same name as just removed works incorrectly if single segment is used (instead of array)
  state.addTagSegments = [state.uiSegmentSrv.newPlusButton()];

  return state;
}

async function pause(state: GraphiteQueryEditorState) {
  return {
    ...state,
    paused: true,
  };
}

export async function unpause(state: GraphiteQueryEditorState) {
  state = { ...state };

  state.paused = false;
  state.panelCtrl.refresh();

  return state;
}

async function handleTagsAutoCompleteError(
  state: GraphiteQueryEditorState,
  error: Error
): Promise<GraphiteQueryEditorState> {
  console.error(error);
  if (!state._tagsAutoCompleteErrorShown) {
    state._tagsAutoCompleteErrorShown = true;
    dispatch(notifyApp(createErrorNotification(`Fetching tags failed: ${error.message}.`)));
  }
  return state;
}

async function handleMetricsAutoCompleteError(
  state: GraphiteQueryEditorState,
  error: Error
): Promise<GraphiteQueryEditorState> {
  console.error(error);
  if (!state._metricAutoCompleteErrorShown) {
    state._metricAutoCompleteErrorShown = true;
    dispatch(notifyApp(createErrorNotification(`Fetching metrics failed: ${error.message}.`)));
  }
  return state;
}

// TODO: move to util.ts
function mapToDropdownOptions(results: any[]) {
  return _.map(results, (value) => {
    return { text: value, value: value };
  });
}

// TODO: move to util.ts
function removeTagPrefix(value: string): string {
  return value.replace(TAG_PREFIX, '');
}

const controller = {
  init,
};

export default controller;

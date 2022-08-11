import { AnyAction } from '@reduxjs/toolkit';
import { Action, Dispatch } from 'redux';

import { DataQuery, TimeRange } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { TemplateSrv } from '../../../../features/templating/template_srv';
import { GraphiteDatasource } from '../datasource';
import { FuncDefs } from '../gfunc';
import GraphiteQuery, { GraphiteTarget } from '../graphite_query';
import { GraphiteSegment, GraphiteTagOperator } from '../types';

import { actions } from './actions';
import {
  addSeriesByTagFunc,
  buildSegments,
  checkOtherSegments,
  emptySegments,
  handleTargetChanged,
  parseTarget,
  pause,
  removeTagPrefix,
  smartlyHandleNewAliasByNode,
  spliceSegments,
} from './helpers';

export type GraphiteQueryEditorState = {
  // external dependencies
  datasource: GraphiteDatasource;
  target: GraphiteTarget;
  refresh: () => void;
  queries?: DataQuery[];
  templateSrv: TemplateSrv;
  range?: TimeRange;

  // internal
  supportsTags: boolean;
  paused: boolean;
  removeTagValue: string;
  funcDefs: FuncDefs | null;
  segments: GraphiteSegment[];
  queryModel: GraphiteQuery;
  error: Error | null;
  tagsAutoCompleteErrorShown: boolean;
  metricAutoCompleteErrorShown: boolean;
};

const reducer = async (action: Action, state: GraphiteQueryEditorState): Promise<GraphiteQueryEditorState> => {
  state = { ...state };

  if (actions.init.match(action)) {
    const deps = action.payload;
    deps.target.target = deps.target.target || '';

    await deps.datasource.waitForFuncDefsLoaded();

    state = {
      ...state,
      ...deps,
      queryModel: new GraphiteQuery(deps.datasource, deps.target, getTemplateSrv()),
      supportsTags: deps.datasource.supportsTags,
      paused: false,
      removeTagValue: '-- remove tag --',
      funcDefs: deps.datasource.funcDefs,
      queries: deps.queries,
    };

    await buildSegments(state, false);
  }
  if (actions.timeRangeChanged.match(action)) {
    state.range = action.payload;
  }
  if (actions.queriesChanged.match(action)) {
    state.queries = action.payload;
    handleTargetChanged(state);
  }
  if (actions.queryChanged.match(action)) {
    state.target.target = action.payload.target || '';
    await parseTarget(state);
    handleTargetChanged(state);
  }
  if (actions.segmentValueChanged.match(action)) {
    const { segment: segmentOrString, index: segmentIndex } = action.payload;

    let segment;
    // is segment was changed to a string - create a new segment
    if (typeof segmentOrString === 'string') {
      segment = {
        value: segmentOrString,
        expandable: true,
        fake: false,
      };
    } else {
      segment = segmentOrString as GraphiteSegment;
    }

    state.error = null;
    state.segments[segmentIndex] = segment;
    state.queryModel.updateSegmentValue(segment, segmentIndex);

    if (state.queryModel.functions.length > 0 && state.queryModel.functions[0].def.fake) {
      state.queryModel.functions = [];
    }

    if (segment.type === 'tag') {
      const tag = removeTagPrefix(segment.value);
      pause(state);
      await addSeriesByTagFunc(state, tag);
      return state;
    }

    // if newly selected segment can be expanded -> check if the path is correct
    if (segment.expandable) {
      await checkOtherSegments(state, segmentIndex + 1);
    } else {
      // if not expandable -> remove all other segments
      spliceSegments(state, segmentIndex + 1);
    }

    handleTargetChanged(state);
  }
  if (actions.tagChanged.match(action)) {
    const { tag, index: tagIndex } = action.payload;
    state.queryModel.updateTag(tag, tagIndex);
    handleTargetChanged(state);
    if (state.queryModel.tags.length === 0) {
      await checkOtherSegments(state, 0);
      state.paused = false;
    }
  }
  if (actions.addNewTag.match(action)) {
    const segment = action.payload.segment;
    const newTagKey = segment.value;
    const newTag = { key: newTagKey, operator: '=' as GraphiteTagOperator, value: '' };
    state.queryModel.addTag(newTag);
    handleTargetChanged(state);
  }
  if (actions.unpause.match(action)) {
    state.paused = false;
    state.refresh();
  }
  if (actions.addFunction.match(action)) {
    const newFunc = state.datasource.createFuncInstance(action.payload.name, {
      withDefaultParams: true,
    });
    newFunc.added = true;
    state.queryModel.addFunction(newFunc);
    smartlyHandleNewAliasByNode(state, newFunc);

    if (state.segments.length === 1 && state.segments[0].fake) {
      emptySegments(state);
    }

    if (!newFunc.params.length && newFunc.added) {
      handleTargetChanged(state);
    }

    if (newFunc.def.name === 'seriesByTag') {
      await parseTarget(state);
    }
  }
  if (actions.removeFunction.match(action)) {
    state.queryModel.removeFunction(action.payload.func);
    handleTargetChanged(state);
  }
  if (actions.moveFunction.match(action)) {
    const { func, offset } = action.payload;
    state.queryModel.moveFunction(func, offset);
    handleTargetChanged(state);
  }
  if (actions.updateFunctionParam.match(action)) {
    const { func, index, value } = action.payload;
    func.updateParam(value, index);
    handleTargetChanged(state);
  }
  if (actions.updateQuery.match(action)) {
    state.target.target = action.payload.query;
    handleTargetChanged(state);
  }
  if (actions.runQuery.match(action)) {
    state.refresh();
  }
  if (actions.toggleEditorMode.match(action)) {
    state.target.textEditor = !state.target.textEditor;
    await parseTarget(state);
  }

  return { ...state };
};

export const createStore = (onChange: (state: GraphiteQueryEditorState) => void): Dispatch<AnyAction> => {
  let state = {} as GraphiteQueryEditorState;

  const dispatch = async (action: AnyAction) => {
    state = await reducer(action, state);
    onChange(state);
  };

  return dispatch as Dispatch<AnyAction>;
};

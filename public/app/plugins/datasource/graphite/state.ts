import GraphiteQuery from './graphite_query';
import {
  addFunction,
  addNewTag,
  init,
  moveFunction,
  removeFunction,
  segmentValueChanged,
  tagChanged,
  targetChanged,
  toggleEditorMode,
  unpause,
} from './controller';
import { GraphiteActionDispatcher, GraphiteSegment } from './types';
import { GraphiteDatasource } from './datasource';
import { TemplateSrv } from '../../../features/templating/template_srv';
import { actions } from './actions';

/**
 * XXX: Work in progress.
 *
 * The state is the result of migrating properties from QueryCtrl + adding some properties that in angular where
 * internally received and processed by directives without modifying the state.
 */
export type GraphiteQueryEditorState = {
  /**
   * Extra segment with plus button when tags are rendered
   */
  addTagSegments: GraphiteSegment[];

  supportsTags: boolean;
  paused: boolean;
  removeTagValue: string;

  datasource: GraphiteDatasource;

  uiSegmentSrv: any;
  templateSrv: TemplateSrv;
  panelCtrl: any;

  target: { target: string; textEditor: boolean };

  segments: GraphiteSegment[];
  queryModel: GraphiteQuery;

  error: Error | null;

  tagsAutoCompleteErrorShown: boolean;
  metricAutoCompleteErrorShown: boolean;
};

type Action = {
  type: string;
  payload: any;
};

const reducer = async (action: Action, state: GraphiteQueryEditorState): Promise<GraphiteQueryEditorState> => {
  if (actions.init.match(action)) {
    state = await init(state, action.payload);
  }
  if (actions.segmentValueChanged.match(action)) {
    state = await segmentValueChanged(state, action.payload.segment, action.payload.index);
  }
  if (actions.tagChanged.match(action)) {
    state = await tagChanged(state, action.payload.tag, action.payload.index);
  }
  if (actions.addNewTag.match(action)) {
    state = await addNewTag(state, action.payload.segment);
  }
  if (actions.unpause.match(action)) {
    state = await unpause(state);
  }
  if (actions.addFunction.match(action)) {
    state = await addFunction(state, action.payload.name);
  }
  if (actions.removeFunction.match(action)) {
    state = await removeFunction(state, action.payload.funcDef);
  }
  if (actions.moveFunction.match(action)) {
    state = await moveFunction(state, action.payload.funcDef, action.payload.offset);
  }
  if (actions.targetChanged.match(action)) {
    state = await targetChanged(state);
  }
  if (actions.toggleEditorMode.match(action)) {
    state = await toggleEditorMode(state);
  }

  return { ...state };
};

export const createStore = (
  onChange: (state: GraphiteQueryEditorState) => void
): [GraphiteActionDispatcher, GraphiteQueryEditorState] => {
  let state = {} as GraphiteQueryEditorState;

  const dispatch = async (action: Action) => {
    state = await reducer(action, state);
    onChange(state);
  };

  return [dispatch, state];
};

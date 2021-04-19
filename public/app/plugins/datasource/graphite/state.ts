import GraphiteQuery from './graphite_query';
import {
  addFunction,
  addNewTag,
  getAltSegments,
  getTagOperators,
  getTags,
  getTagsAsSegments,
  getTagValues,
  init,
  moveFunction,
  removeFunction,
  segmentValueChanged,
  tagChanged,
  targetChanged,
  toggleEditorMode,
  unpause,
} from './controller';
import { AngularDropdownOptions, GraphiteActionDispatcher, GraphiteSegment } from './types';
import { GraphiteDatasource } from './datasource';
import { TemplateSrv } from '../../../features/templating/template_srv';

/**
 * XXX: Work in progress.
 *
 * The state is the result of migrating properties from QueryCtrl + adding some properties that in angular where
 * internally received and processed by directives without modifying the state.
 */
export type GraphiteQueryEditorState = {
  tagOperators: AngularDropdownOptions[];
  tagValues: AngularDropdownOptions[];
  allTags: AngularDropdownOptions[];
  allTagValues: AngularDropdownOptions[];

  addTagSegments: GraphiteSegment[];

  tagsAsSegments: GraphiteSegment[];
  tagSegments: GraphiteSegment[];

  supportsTags: boolean;
  paused: boolean;
  removeTagValue: string;

  datasource: GraphiteDatasource;

  uiSegmentSrv: any;
  templateSrv: TemplateSrv;
  panelCtrl: any;

  target: { target: string; textEditor: boolean };

  altSegments: GraphiteSegment[];
  segments: any;
  queryModel: GraphiteQuery;

  error: Error | null;

  _tagsAutoCompleteErrorShown: boolean;
  _metricAutoCompleteErrorShown: boolean;
};

type Action = {
  type: string;
  payload: any;
};

const reducer = async (
  action: Action,
  state: GraphiteQueryEditorState,
  _tempoCtrl: any
): Promise<GraphiteQueryEditorState> => {
  switch (action.type) {
    case 'INIT':
      state = await init(state, action.payload);
      break;
    case 'GET_ALT_SEGMENTS':
      state = await getAltSegments(state, action.payload.segmentIndex, action.payload.text);
      break;
    case 'SEGMENT_VALUE_CHANGED':
      state = await segmentValueChanged(state, action.payload.segment, action.payload.index);
      break;
    case 'GET_TAGS':
      state = await getTags(state, action.payload.index, action.payload.query);
      break;
    case 'TAG_CHANGED':
      state = await tagChanged(state, action.payload.tag, action.payload.index);
      break;
    case 'GET_TAG_VALUES':
      state = await getTagValues(state, action.payload.tag, action.payload.index, action.payload.query);
      break;
    case 'GET_TAG_OPERATORS':
      state = await getTagOperators(state);
      break;
    case 'GET_TAGS_AS_SEGMENTS':
      state = await getTagsAsSegments(state, action.payload.query);
      break;
    case 'ADD_NEW_TAG':
      state = await addNewTag(state, action.payload.segment);
      break;
    case 'UNPAUSE':
      state = await unpause(state);
      break;
    case 'ADD_FUNCTION':
      state = await addFunction(state, action.payload.name);
      break;
    case 'REMOVE_FUNCTION':
      state = await removeFunction(state, action.payload.funcDef);
      break;
    case 'MOVE_FUNCTION':
      state = await moveFunction(state, action.payload.funcDef, action.payload.offset);
      break;
    case 'TARGET_CHANGED':
      state = await targetChanged(state);
      break;
    case 'TOGGLE_EDITOR':
      state = await toggleEditorMode(state);
      break;
    default:
      console.warn('Unhandled action:', action);
  }

  return { ...state };
};

export const create = (
  ctrl: any,
  onChange: (state: GraphiteQueryEditorState) => void
): [GraphiteActionDispatcher, GraphiteQueryEditorState] => {
  let state = {} as GraphiteQueryEditorState;

  const dispatch = async (action: Action) => {
    state = await reducer(action, state, ctrl);
    onChange(state);
  };

  return [dispatch, state];
};

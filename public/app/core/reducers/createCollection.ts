import { createAction, PayloadAction } from '@reduxjs/toolkit';
import { StoreState } from '../../types';
import { Reducer } from 'redux';

export interface CollectionReducerState<InstanceState extends {}> {
  [key: string]: InstanceState;
}

interface CollectionAction {
  id: string;
  action: PayloadAction<any>;
}
const COLLECTION_UNKNOWN_ID = 'unknown-id';
const collectionAction = createAction<CollectionAction>('collectionAction');
export const toCollectionAction = (action: PayloadAction<any>, id: string) => collectionAction({ id, action });

export const createCollection = <InstanceState extends {}>(args: {
  instanceReducer: Reducer<InstanceState>;
  stateSelector: (state: StoreState) => CollectionReducerState<InstanceState>;
}) => {
  const { instanceReducer, stateSelector } = args;

  // there might be a better redux toolkit way to create HOC reducer but I couldn't find anything
  const reducer = (
    state: CollectionReducerState<InstanceState> = {},
    colAction: PayloadAction
  ): CollectionReducerState<InstanceState> => {
    if (!collectionAction.match(colAction)) {
      return state;
    }

    const { id, action } = colAction.payload;
    const collectionId = id ?? COLLECTION_UNKNOWN_ID;

    const oldState = state[collectionId];
    const newState = instanceReducer(oldState, action);

    return {
      ...state,
      [collectionId]: {
        ...oldState,
        ...newState,
      },
    };
  };

  const selector = (state: StoreState, id: string): InstanceState => {
    const collectionId = id ?? COLLECTION_UNKNOWN_ID;
    const instanceState = stateSelector(state)[collectionId] ?? instanceReducer(undefined, { type: '' });

    return instanceState;
  };

  return {
    reducer,
    selector,
  };
};

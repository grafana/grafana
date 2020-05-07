import { PayloadAction } from '@reduxjs/toolkit';
import { StoreState } from '../../types';
import { Reducer } from 'redux';

export interface CollectionState<InstanceState extends {}> {
  [key: string]: InstanceState;
}

interface CollectionAction {
  id: string | undefined;
  action: PayloadAction<any>;
}
export const COLLECTION_UNKNOWN_ID = 'unknown-id';
const COLLECTION_ACTION_PREFIX = 'collectionAction::';
export const toCollectionAction = (
  action: PayloadAction<any>,
  id: string | undefined
): PayloadAction<CollectionAction> => ({
  type: `${COLLECTION_ACTION_PREFIX}${action.type}`, // makes it easier to debug in Redux dev tools
  payload: { id, action },
});

export const createCollection = <InstanceState extends {}>(args: {
  instanceReducer: Reducer<InstanceState>;
  stateSelector: (state: StoreState) => CollectionState<InstanceState>;
}) => {
  const { instanceReducer, stateSelector } = args;

  // there might be a better redux toolkit way to create HOC reducer but I couldn't find anything
  const reducer = (
    state: CollectionState<InstanceState> = {},
    collectionAction: PayloadAction<CollectionAction>
  ): CollectionState<InstanceState> => {
    if (collectionAction.type.indexOf(COLLECTION_ACTION_PREFIX) !== 0) {
      return state;
    }

    const { id, action } = collectionAction.payload;
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

  const selector = (state: StoreState, id: string | undefined): InstanceState => {
    const collectionId = id ?? COLLECTION_UNKNOWN_ID;
    const instanceState = stateSelector(state)[collectionId] ?? instanceReducer(undefined, { type: '' });

    return instanceState;
  };

  return {
    reducer,
    selector,
  };
};

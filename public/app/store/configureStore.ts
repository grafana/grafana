import { configureStore as reduxConfigureStore } from '@reduxjs/toolkit';
import { toggleLogActionsMiddleware } from 'app/core/middlewares/application';
import { StoreState } from 'app/types/store';
import { createLogger } from 'redux-logger';
import { buildInitialState } from '../core/reducers/navModel';
import { addReducer, createRootReducer } from '../core/reducers/root';
import { setStore } from './store';

export function addRootReducer(reducers: any) {
  // this is ok now because we add reducers before configureStore is called
  // in the future if we want to add reducers during runtime
  // we'll have to solve this in a more dynamic way
  addReducer(reducers);
}

export function configureStore(initialState?: Partial<StoreState>) {
  const logger = createLogger({
    predicate: (getState) => {
      return getState().application.logActions;
    },
  });

  const loggerMiddleware = process.env.NODE_ENV !== 'production' ? [toggleLogActionsMiddleware, logger] : [];
  const store = reduxConfigureStore({
    reducer: createRootReducer(),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: { ignoredPaths: getPathsToIgnoreMutationAndSerializableCheckOn() },
      }).concat(loggerMiddleware),
    devTools: process.env.NODE_ENV !== 'production',
    preloadedState: {
      navIndex: buildInitialState(),
      ...initialState,
    },
  });

  setStore(store);
  return store;
}

function getPathsToIgnoreMutationAndSerializableCheckOn() {
  return [
    'plugins.panels',
    'dashboard.panels',
    'dashboard.getModel',
    'payload.plugin',
    'panelEditorNew.getPanel',
    'panelEditorNew.getSourcePanel',
    'panelEditorNew.getData',
    'explore.left.queryResponse',
    'explore.right.queryResponse',
    'explore.left.datasourceInstance',
    'explore.right.datasourceInstance',
    'explore.left.range',
    'explore.left.eventBridge',
    'explore.right.eventBridge',
    'explore.right.range',
    'explore.left.querySubscription',
    'explore.right.querySubscription',
  ];
}

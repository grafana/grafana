import { createStore, applyMiddleware, compose, combineReducers } from 'redux';
import thunk from 'redux-thunk';
import { createLogger } from 'redux-logger';
import { navReducer } from './nav/reducers';

const rootReducer = combineReducers({
  nav: navReducer,
});

export let store;

export function configureStore() {
  const composeEnhancers = (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
  store = createStore(rootReducer, {}, composeEnhancers(applyMiddleware(thunk, createLogger())));
}

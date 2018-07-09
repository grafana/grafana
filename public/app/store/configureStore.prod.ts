import { createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';
import rootReducer from './reducers';

export let store;

export function configureStore() {
  store = createStore(rootReducer, {}, compose(applyMiddleware(thunk)));
}

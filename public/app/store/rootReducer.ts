import * as ActionTypes from '../actions';
import { combineReducers } from 'redux';
import { nav } from './nav';

// Updates error message to notify about the failed fetches.
const errorMessage = (state = null, action) => {
  const { type, error } = action;

  if (type === ActionTypes.RESET_ERROR_MESSAGE) {
    return null;
  } else if (error) {
    return error;
  }

  return state;
};

const rootReducer = combineReducers({
  nav,
  errorMessage,
});

export default rootReducer;

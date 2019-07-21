import { ApplicationState } from 'app/types/application';
import { reducerFactory } from 'app/core/redux';
import { toggleLogActions } from '../actions/application';

export const initialState: ApplicationState = {
  logActions: false,
};

export const applicationReducer = reducerFactory<ApplicationState>(initialState)
  .addMapper({
    filter: toggleLogActions,
    mapper: (state): ApplicationState => ({
      ...state,
      logActions: !state.logActions,
    }),
  })
  .create();

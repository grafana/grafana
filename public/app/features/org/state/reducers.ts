import { Organisation, OrganisationPreferences, OrganisationState } from 'app/types';
import { Action, ActionTypes } from './actions';

const initialState: OrganisationState = {
  organisation: {} as Organisation,
  preferences: {} as OrganisationPreferences,
};

const organisationReducer = (state = initialState, action: Action): OrganisationState => {
  switch (action.type) {
    case ActionTypes.LoadOrganisation:
      return { ...state, organisation: action.payload };

    case ActionTypes.LoadPreferences:
      return { ...state, preferences: action.payload };
  }

  return state;
};

export default {
  organisation: organisationReducer,
};

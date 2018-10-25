import { DashboardAcl, Organization, OrganisationPreferences, OrganisationState } from 'app/types';
import { Action, ActionTypes } from './actions';

const initialState: OrganisationState = {
  organisation: {} as Organization,
  preferences: {} as OrganisationPreferences,
  starredDashboards: [] as DashboardAcl[],
};

const organisationReducer = (state = initialState, action: Action): OrganisationState => {
  switch (action.type) {
    case ActionTypes.LoadOrganisation:
      return { ...state, organisation: action.payload };

    case ActionTypes.LoadPreferences:
      return { ...state, preferences: action.payload };

    case ActionTypes.LoadStarredDashboards:
      return { ...state, starredDashboards: action.payload };
  }

  return state;
};

export default {
  organisation: organisationReducer,
};

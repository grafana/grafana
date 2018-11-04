import { Organization, OrganizationPreferences, OrganizationState } from 'app/types';
import { Action, ActionTypes } from './actions';

const initialState: OrganizationState = {
  organization: {} as Organization,
  preferences: {} as OrganizationPreferences,
};

const organizationReducer = (state = initialState, action: Action): OrganizationState => {
  switch (action.type) {
    case ActionTypes.LoadOrganization:
      return { ...state, organization: action.payload };

    case ActionTypes.LoadPreferences:
      return { ...state, preferences: action.payload };

    case ActionTypes.SetOrganizationName:
      return { ...state, organization: { ...state.organization, name: action.payload } };

    case ActionTypes.SetOrganizationTheme:
      return { ...state, preferences: { ...state.preferences, theme: action.payload } };

    case ActionTypes.SetOrganizationHomeDashboard:
      return { ...state, preferences: { ...state.preferences, homeDashboardId: action.payload } };

    case ActionTypes.SetOrganizationTimezone:
      return { ...state, preferences: { ...state.preferences, timezone: action.payload } };
  }

  return state;
};

export default {
  organization: organizationReducer,
};

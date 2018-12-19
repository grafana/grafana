import { Organization, OrganizationState } from 'app/types';
import { Action, ActionTypes } from './actions';

const initialState: OrganizationState = {
  organization: {} as Organization,
};

const organizationReducer = (state = initialState, action: Action): OrganizationState => {
  switch (action.type) {
    case ActionTypes.LoadOrganization:
      return { ...state, organization: action.payload };

    case ActionTypes.SetOrganizationName:
      return { ...state, organization: { ...state.organization, name: action.payload } };
  }

  return state;
};

export default {
  organization: organizationReducer,
};

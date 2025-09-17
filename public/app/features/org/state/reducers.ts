import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { OrganizationState, Organization } from 'app/types/organization';
import { UserOrg } from 'app/types/user';

export const initialState: OrganizationState = {
  organization: {} as Organization,
  userOrgs: [],
};

const organizationSlice = createSlice({
  name: 'organization',
  initialState,
  reducers: {
    organizationLoaded: (state, action: PayloadAction<Organization>): OrganizationState => {
      return { ...state, organization: action.payload };
    },
    setOrganizationName: (state, action: PayloadAction<string>): OrganizationState => {
      return { ...state, organization: { ...state.organization, name: action.payload } };
    },
    userOrganizationsLoaded: (state, action: PayloadAction<UserOrg[]>): OrganizationState => {
      return { ...state, userOrgs: action.payload };
    },
  },
});

export const { setOrganizationName, organizationLoaded, userOrganizationsLoaded } = organizationSlice.actions;

export const organizationReducer = organizationSlice.reducer;

export default {
  organization: organizationReducer,
};

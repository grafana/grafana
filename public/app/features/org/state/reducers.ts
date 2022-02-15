import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { OrganizationState, UserOrg } from 'app/types';

export const initialState: OrganizationState = {
  userOrgs: [],
};

const organizationSlice = createSlice({
  name: 'organization',
  initialState,
  reducers: {
    userOrganizationsLoaded: (state, action: PayloadAction<UserOrg[]>) => {
      state.userOrgs = action.payload;
    },
  },
});

export const { userOrganizationsLoaded } = organizationSlice.actions;

export const organizationReducer = organizationSlice.reducer;

export default {
  organization: organizationReducer,
};

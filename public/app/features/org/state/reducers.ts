import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { Organization, OrganizationState } from 'app/types';

export const initialState: OrganizationState = {
  organization: {} as Organization,
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
  },
});

export const { setOrganizationName, organizationLoaded } = organizationSlice.actions;

export const organizationReducer = organizationSlice.reducer;

export default {
  organization: organizationReducer,
};

import { createSlice } from '@reduxjs/toolkit';
export const initialState = {
    organization: {},
    userOrgs: [],
};
const organizationSlice = createSlice({
    name: 'organization',
    initialState,
    reducers: {
        organizationLoaded: (state, action) => {
            return Object.assign(Object.assign({}, state), { organization: action.payload });
        },
        setOrganizationName: (state, action) => {
            return Object.assign(Object.assign({}, state), { organization: Object.assign(Object.assign({}, state.organization), { name: action.payload }) });
        },
        userOrganizationsLoaded: (state, action) => {
            return Object.assign(Object.assign({}, state), { userOrgs: action.payload });
        },
    },
});
export const { setOrganizationName, organizationLoaded, userOrganizationsLoaded } = organizationSlice.actions;
export const organizationReducer = organizationSlice.reducer;
export default {
    organization: organizationReducer,
};
//# sourceMappingURL=reducers.js.map
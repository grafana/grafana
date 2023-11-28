import { createSlice } from '@reduxjs/toolkit';
export const initialApiKeysState = {
    hasFetched: false,
    includeExpired: false,
    keys: [],
    keysIncludingExpired: [],
    searchQuery: '',
    migrationResult: {
        total: 0,
        migrated: 0,
        failed: 0,
        failedApikeyIDs: [0],
        failedDetails: [],
    },
};
const apiKeysSlice = createSlice({
    name: 'apiKeys',
    initialState: initialApiKeysState,
    reducers: {
        apiKeysLoaded: (state, action) => {
            const { keys, keysIncludingExpired } = action.payload;
            const includeExpired = action.payload.keys.length === 0 && action.payload.keysIncludingExpired.length > 0
                ? true
                : state.includeExpired;
            return Object.assign(Object.assign({}, state), { hasFetched: true, keys, keysIncludingExpired, includeExpired });
        },
        setSearchQuery: (state, action) => {
            return Object.assign(Object.assign({}, state), { searchQuery: action.payload });
        },
        includeExpiredToggled: (state) => {
            return Object.assign(Object.assign({}, state), { includeExpired: !state.includeExpired });
        },
        isFetching: (state) => {
            return Object.assign(Object.assign({}, state), { hasFetched: false });
        },
        setMigrationResult: (state, action) => {
            return Object.assign(Object.assign({}, state), { migrationResult: action.payload });
        },
    },
});
export const { apiKeysLoaded, includeExpiredToggled, isFetching, setSearchQuery, setMigrationResult } = apiKeysSlice.actions;
export const apiKeysReducer = apiKeysSlice.reducer;
export default {
    apiKeys: apiKeysReducer,
};
//# sourceMappingURL=reducers.js.map
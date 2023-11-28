import { __awaiter } from "tslib";
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { withSerializedError } from 'app/features/alerting/unified/utils/redux';
import { UserService } from 'app/percona/shared/services/user/User.service';
import { toMap, toUserItem } from './users.utils';
const initialState = {
    isLoading: false,
    users: [],
    usersMap: {},
};
const usersSlice = createSlice({
    name: 'users',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(fetchUsersListAction.pending, (state) => (Object.assign(Object.assign({}, state), { isLoading: true })));
        builder.addCase(fetchUsersListAction.rejected, (state) => (Object.assign(Object.assign({}, state), { isLoading: false })));
        builder.addCase(fetchUsersListAction.fulfilled, (state, action) => (Object.assign(Object.assign({}, state), { users: action.payload, usersMap: toMap(action.payload), isLoading: false })));
    },
});
export const fetchUsersListAction = createAsyncThunk('percona/fetchUsersList', () => __awaiter(void 0, void 0, void 0, function* () {
    return withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield UserService.getUsersList();
        return res.users.map(toUserItem);
    }))());
}));
export default usersSlice.reducer;
//# sourceMappingURL=users.js.map
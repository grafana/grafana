import { __awaiter } from "tslib";
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { withSerializedError } from 'app/features/alerting/unified/utils/redux';
import { UserService } from '../../../services/user/User.service';
import { toUserDetailsModel } from './user.utils';
export const initialUserState = {
    userId: 0,
    productTourCompleted: true,
    alertingTourCompleted: true,
    isAuthorized: false,
    isPlatformUser: false,
};
const perconaUserSlice = createSlice({
    name: 'perconaUser',
    initialState: initialUserState,
    reducers: {
        setAuthorized: (state, action) => (Object.assign(Object.assign({}, state), { isAuthorized: action.payload })),
        setIsPlatformUser: (state, action) => (Object.assign(Object.assign({}, state), { isPlatformUser: action.payload })),
        setUserDetails: (state, action) => (Object.assign(Object.assign({}, state), action.payload)),
    },
});
export const fetchUserStatusAction = createAsyncThunk('percona/fetchUserStatus', (_, thunkAPI) => withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
    const isPlatformUser = yield UserService.getUserStatus(undefined, true);
    thunkAPI.dispatch(setIsPlatformUser(isPlatformUser));
}))()));
export const fetchUserDetailsAction = createAsyncThunk('percona/fetchUserDetails', (_, thunkAPI) => __awaiter(void 0, void 0, void 0, function* () {
    const res = yield UserService.getUserDetails();
    const details = toUserDetailsModel(res);
    thunkAPI.dispatch(setUserDetails(details));
    return details;
}));
export const setProductTourCompleted = createAsyncThunk('percona/setProductTourCompleted', (productTourCompleted, thunkAPI) => __awaiter(void 0, void 0, void 0, function* () {
    const res = yield UserService.setProductTourCompleted(productTourCompleted);
    const details = toUserDetailsModel(res);
    thunkAPI.dispatch(setUserDetails(details));
    return details;
}));
export const setAlertingTourCompleted = createAsyncThunk('percona/setAlertingTourCompleted', (alertingTourCompleted, thunkAPI) => __awaiter(void 0, void 0, void 0, function* () {
    const res = yield UserService.setAlertingTourCompeted(alertingTourCompleted);
    const details = toUserDetailsModel(res);
    thunkAPI.dispatch(setUserDetails(details));
    return details;
}));
export const { setAuthorized, setIsPlatformUser, setUserDetails } = perconaUserSlice.actions;
export default perconaUserSlice.reducer;
//# sourceMappingURL=user.js.map
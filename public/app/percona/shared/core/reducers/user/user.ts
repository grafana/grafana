import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { withSerializedError } from 'app/features/alerting/unified/utils/redux';

import { UserService } from '../../../services/user/User.service';

import { PerconaUserState, UserDetails } from './user.types';
import { toUserDetailsModel } from './user.utils';

export const initialUserState: PerconaUserState = {
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
    setAuthorized: (state, action: PayloadAction<boolean>): PerconaUserState => ({
      ...state,
      isAuthorized: action.payload,
    }),
    setIsPlatformUser: (state, action: PayloadAction<boolean>): PerconaUserState => ({
      ...state,
      isPlatformUser: action.payload,
    }),
    setUserDetails: (state, action: PayloadAction<UserDetails>) => ({
      ...state,
      ...action.payload,
    }),
  },
});

export const fetchUserStatusAction = createAsyncThunk(
  'percona/fetchUserStatus',
  (_, thunkAPI): Promise<void> =>
    withSerializedError(
      (async () => {
        const isPlatformUser = await UserService.getUserStatus(undefined, true);
        thunkAPI.dispatch(setIsPlatformUser(isPlatformUser));
      })()
    )
);

export const fetchUserDetailsAction = createAsyncThunk(
  'percona/fetchUserDetails',
  async (_, thunkAPI): Promise<UserDetails> => {
    const res = await UserService.getUserDetails();
    const details = toUserDetailsModel(res);
    thunkAPI.dispatch(setUserDetails(details));
    return details;
  }
);

export const setProductTourCompleted = createAsyncThunk(
  'percona/setProductTourCompleted',
  async (productTourCompleted: boolean, thunkAPI): Promise<UserDetails> => {
    const res = await UserService.setProductTourCompleted(productTourCompleted);
    const details = toUserDetailsModel(res);
    thunkAPI.dispatch(setUserDetails(details));
    return details;
  }
);

export const setAlertingTourCompleted = createAsyncThunk(
  'percona/setAlertingTourCompleted',
  async (alertingTourCompleted: boolean, thunkAPI): Promise<UserDetails> => {
    const res = await UserService.setAlertingTourCompeted(alertingTourCompleted);
    const details = toUserDetailsModel(res);
    thunkAPI.dispatch(setUserDetails(details));
    return details;
  }
);

export const { setAuthorized, setIsPlatformUser, setUserDetails } = perconaUserSlice.actions;

export default perconaUserSlice.reducer;

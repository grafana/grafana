import _ from 'lodash';
import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { UserState, ThunkResult } from 'app/types';
import config from 'app/core/config';
import { TimeZone } from '@grafana/data';
import { contextSrv } from 'app/core/core';

export const initialState: UserState = {
  orgId: config.bootData.user.orgId,
  timeZone: config.bootData.user.timezone,
};

export const slice = createSlice({
  name: 'user/profile',
  initialState,
  reducers: {
    updateTimeZone: (state, action: PayloadAction<TimeZone>): UserState => {
      return {
        ...state,
        timeZone: action.payload,
      };
    },
  },
});

export const updateTimeZoneForSession = (timeZone: TimeZone): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const { updateTimeZone } = slice.actions;

    if (!_.isString(timeZone) || _.isEmpty(timeZone)) {
      timeZone = config?.bootData?.user?.timezone;
    }

    _.set(contextSrv, 'user.timezone', timeZone);
    dispatch(updateTimeZone(timeZone));
  };
};

export const userReducer = slice.reducer;
export default { user: slice.reducer };

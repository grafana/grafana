/* eslint-disable no-restricted-imports */
import {
  Action,
  addListener as addListenerUntyped,
  AsyncThunk,
  AsyncThunkOptions,
  AsyncThunkPayloadCreator,
  createAsyncThunk as createAsyncThunkUntyped,
  PayloadAction,
  TypedAddListener,
} from '@reduxjs/toolkit';
import {
  TypedUseSelectorHook,
  useDispatch as useDispatchUntyped,
  useSelector as useSelectorUntyped,
} from 'react-redux';
import { ThunkDispatch as GenericThunkDispatch, ThunkAction } from 'redux-thunk';

import type { createRootReducer } from '../reducers/root';
import { AppDispatch, RootState } from '../store/configureStore';
import { dispatch as storeDispatch } from '../store/store';

export type StoreState = ReturnType<ReturnType<typeof createRootReducer>>;

/*
 * Utility type to get strongly types thunks
 */
export type ThunkResult<R> = ThunkAction<R, StoreState, undefined, PayloadAction<unknown>>;

export type ThunkDispatch = GenericThunkDispatch<StoreState, undefined, Action>;

// Typed useDispatch & useSelector hooks
export const useDispatch: () => AppDispatch = useDispatchUntyped;
export const useSelector: TypedUseSelectorHook<RootState> = useSelectorUntyped;

type DefaultThunkApiConfig = { dispatch: AppDispatch; state: StoreState };
export const createAsyncThunk = <Returned, ThunkArg = void, ThunkApiConfig extends {} = DefaultThunkApiConfig>(
  typePrefix: string,
  payloadCreator: AsyncThunkPayloadCreator<Returned, ThunkArg, ThunkApiConfig>,
  options?: AsyncThunkOptions<ThunkArg, ThunkApiConfig>
): AsyncThunk<Returned, ThunkArg, ThunkApiConfig> =>
  createAsyncThunkUntyped<Returned, ThunkArg, ThunkApiConfig>(typePrefix, payloadCreator, options);

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export const addListener = addListenerUntyped as TypedAddListener<RootState, AppDispatch>;
export const dispatch: AppDispatch = storeDispatch;

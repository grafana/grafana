import { ThunkAction, ThunkDispatch as GenericThunkDispatch } from 'redux-thunk';
import { Action, PayloadAction } from '@reduxjs/toolkit';
import type { createRootReducer } from 'app/core/reducers/root';

export type StoreState = ReturnType<ReturnType<typeof createRootReducer>>;

/*
 * Utility type to get strongly types thunks
 */
export type ThunkResult<R> = ThunkAction<R, StoreState, undefined, PayloadAction<any>>;

export type ThunkDispatch = GenericThunkDispatch<StoreState, undefined, Action>;

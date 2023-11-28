/* eslint-disable no-restricted-imports */
import { addListener as addListenerUntyped, createAsyncThunk as createAsyncThunkUntyped, } from '@reduxjs/toolkit';
import { useSelector as useSelectorUntyped, useDispatch as useDispatchUntyped, } from 'react-redux';
// Typed useDispatch & useSelector hooks
export const useDispatch = useDispatchUntyped;
export const useSelector = useSelectorUntyped;
export const createAsyncThunk = (typePrefix, payloadCreator, options) => createAsyncThunkUntyped(typePrefix, payloadCreator, options);
export const addListener = addListenerUntyped;
//# sourceMappingURL=store.js.map
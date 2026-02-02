import { Action } from 'redux';

export interface ConfigAction extends Action {
  payload?: any;
}

export const GEN_ERR = 'GEN_ERR';
export const LOAD_END = 'LOAD_END';
export const UPDATE_PLATFORM_URL = 'UPDATE_PLATFORM_URL';

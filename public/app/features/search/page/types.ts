import { Dispatch } from 'react';
import { Action } from 'redux';

export interface DashboardResult {
  UID: string;
  URL: string;
  Name: string;
  Description: string;
  Created: number;
  Updated: number;
}

export interface SearchPageAction extends Action {
  payload?: any;
}

export type SearchPageReducer<S> = [S, Dispatch<SearchPageAction>];

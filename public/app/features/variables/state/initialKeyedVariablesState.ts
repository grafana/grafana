import { type TemplatingState } from './reducers';

export interface KeyedVariablesState {
  lastKey?: string;
  keys: Record<string, TemplatingState>;
}

export const initialKeyedVariablesState: KeyedVariablesState = { keys: {} };

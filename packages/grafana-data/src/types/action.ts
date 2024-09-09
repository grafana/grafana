import { ScopedVars } from './ScopedVars';
import { DataFrame, Field, ValueLinkConfig } from './dataFrame';
import { InterpolateFunction } from './panel';
import { SelectableValue } from './select';

export interface Action<T = ActionType.Fetch, TOptions = FetchOptions> {
  type: T;
  title: string;
  options: TOptions;
}

/**
 * Processed Action Model. The values are ready to use
 */
export interface ActionModel<T = any> {
  title: string;
  onClick: (event: any, origin?: any) => void;
}

interface FetchOptions {
  method: HttpRequestMethod;
  url: string;
  body?: string;
  queryParams?: Array<[string, string]>;
  headers?: Array<[string, string]>;
}

export enum ActionType {
  Fetch = 'fetch',
}

export enum HttpRequestMethod {
  POST = 'POST',
  PUT = 'PUT',
  GET = 'GET',
}

export const httpMethodOptions: SelectableValue[] = [
  { label: HttpRequestMethod.POST, value: HttpRequestMethod.POST },
  { label: HttpRequestMethod.PUT, value: HttpRequestMethod.PUT },
  { label: HttpRequestMethod.GET, value: HttpRequestMethod.GET },
];

export const contentTypeOptions: SelectableValue[] = [
  { label: 'application/json', value: 'application/json' },
  { label: 'text/plain', value: 'text/plain' },
  { label: 'application/xml', value: 'application/xml' },
  { label: 'application/x-www-form-urlencoded', value: 'application/x-www-form-urlencoded' },
];

export const defaultActionConfig: Action = {
  type: ActionType.Fetch,
  title: '',
  options: {
    url: '',
    method: HttpRequestMethod.POST,
    body: '{}',
    queryParams: [],
    headers: [['Content-Type', 'application/json']],
  },
};

export type ActionsArgs = {
  frame: DataFrame;
  field: Field;
  fieldScopedVars: ScopedVars;
  replaceVariables: InterpolateFunction;
  actions: Action[];
  config: ValueLinkConfig;
};

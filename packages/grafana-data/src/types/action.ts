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
  contentType?: string;
  queryParams?: Array<[string, string]>;
  headers?: Array<[string, string]>;
}

export enum ActionType {
  Fetch = 'fetch',
}

export enum HttpRequestMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
}

export const httpMethodOptions: SelectableValue[] = [
  { label: HttpRequestMethod.GET, value: HttpRequestMethod.GET },
  { label: HttpRequestMethod.POST, value: HttpRequestMethod.POST },
  { label: HttpRequestMethod.PUT, value: HttpRequestMethod.PUT },
];

export const contentTypeOptions: SelectableValue[] = [
  { label: 'JSON', value: 'application/json' },
  { label: 'Text', value: 'text/plain' },
  { label: 'JavaScript', value: 'application/javascript' },
  { label: 'HTML', value: 'text/html' },
  { label: 'XML', value: 'application/XML' },
  { label: 'x-www-form-urlencoded', value: 'application/x-www-form-urlencoded' },
];

export const defaultActionConfig: Action = {
  type: ActionType.Fetch,
  title: '',
  options: {
    url: '',
    method: HttpRequestMethod.POST,
    body: '{}',
    contentType: 'application/json',
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

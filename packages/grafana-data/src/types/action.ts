import { CSSProperties, ReactNode } from 'react';

import { SelectableValue } from './select';

export enum ActionType {
  Fetch = 'fetch',
  Infinity = 'infinity',
}

type ActionButtonCssProperties = Pick<CSSProperties, 'backgroundColor'>;

export interface Action {
  type: ActionType;
  title: string;
  [ActionType.Fetch]?: FetchOptions;
  [ActionType.Infinity]?: InfinityOptions;
  confirmation?: string;
  oneClick?: boolean;
  variables?: ActionVariable[];
  style?: ActionButtonCssProperties;
}

/**
 * Processed Action Model. The values are ready to use
 */
export interface ActionModel<T = any> {
  title: string;
  onClick: (event: any, origin?: any, actionVars?: ActionVariableInput) => void;
  confirmation: (actionVars?: ActionVariableInput) => ReactNode;
  oneClick?: boolean;
  style: ActionButtonCssProperties;
  variables?: ActionVariable[];
}

export type ActionVariable = {
  key: string;
  name: string;
  type: ActionVariableType;
};

export enum ActionVariableType {
  String = 'string',
}

export interface FetchOptions {
  method: HttpRequestMethod;
  url: string;
  body?: string;
  queryParams?: Array<[string, string]>;
  headers?: Array<[string, string]>;
}

export interface InfinityOptions extends FetchOptions {
  datasourceUid: string;
}

export enum HttpRequestMethod {
  POST = 'POST',
  PUT = 'PUT',
  GET = 'GET',
  DELETE = 'DELETE',
}

export const httpMethodOptions: SelectableValue[] = [
  { label: HttpRequestMethod.POST, value: HttpRequestMethod.POST },
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
  [ActionType.Fetch]: {
    url: '',
    method: HttpRequestMethod.POST,
    body: '{}',
    queryParams: [],
    headers: [['Content-Type', 'application/json']],
  },
};

export type ActionVariableInput = { [key: string]: string };

import { CSSProperties, ReactNode } from 'react';

import { SelectableValue } from './select';

export enum ActionType {
  Fetch = 'fetch',
  Proxy = 'proxy',
}

type ActionButtonCssProperties = Pick<CSSProperties, 'backgroundColor'>;

export interface Action {
  type: ActionType;
  title: string;

  // Options for the selected type
  [ActionType.Fetch]?: FetchOptions;
  [ActionType.Proxy]?: ProxyOptions;
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

interface FetchOptions {
  method: HttpRequestMethod;
  url: string;
  body?: string;
  queryParams?: Array<[string, string]>;
  headers?: Array<[string, string]>;
}

export interface ProxyOptions extends FetchOptions {
  type: 'yesoreyeram-infinity-datasource'; // Infinity?
  datasourceUid: string;
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
  fetch: {
    url: '',
    method: HttpRequestMethod.POST,
    body: '{}',
    queryParams: [],
    headers: [['Content-Type', 'application/json']],
  },
};

export type ActionVariableInput = { [key: string]: string };

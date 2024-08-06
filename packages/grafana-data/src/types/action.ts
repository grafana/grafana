import { InterpolateFunction } from './panel';
import { SelectableValue } from './select';

export interface Action<T = any> {
  title: string;
  method: string;
  endpoint: string;
  data?: string;
  contentType?: string;
  queryParams?: Array<[string, string]>;
  headerParams?: Array<[string, string]>;

  // If exists, handle click directly
  // Not saved in JSON/DTO
  onClick?: (event: ActionClickEvent) => T;
}

/**
 * Processed Action Model. The values are ready to use
 */
export interface ActionModel<T = any> {
  title: string;

  // When a click callback exists, this is passed the raw mouse|react event
  onClick?: (e: any, origin?: any) => void;
}

export interface ActionClickEvent<T = any> {
  origin: T;
  replaceVariables: InterpolateFunction | undefined;
  clickEvent?: any; // mouse|react event
}

export enum HttpRequestMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
}

export const httpMethodOptions = [
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
  title: '',
  endpoint: '',
  method: HttpRequestMethod.POST,
  data: '{}',
  contentType: 'application/json',
  queryParams: [],
  headerParams: [],
};

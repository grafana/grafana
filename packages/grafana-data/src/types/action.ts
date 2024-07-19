import { HttpRequestMethod } from '../../../../public/app/plugins/panel/canvas/panelcfg.gen';

import { SelectableValue } from './select';

export interface Action {
  title: string;
  method: string;
  endpoint: string;
  data?: string;
  contentType?: string;
  queryParams?: Array<[string, string]>;
  headerParams?: Array<[string, string]>;
  sortIndex?: number;
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

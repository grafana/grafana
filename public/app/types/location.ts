export interface LocationUpdate {
  path?: string;
  query?: UrlQueryMap;
  routeParams?: UrlQueryMap;
  partial?: boolean;
}

export interface LocationState {
  url: string;
  path: string;
  query: UrlQueryMap;
  routeParams: UrlQueryMap;
}

export type UrlQueryValue = string | number | boolean | string[] | number[] | boolean[];
export type UrlQueryMap = { [s: string]: UrlQueryValue };

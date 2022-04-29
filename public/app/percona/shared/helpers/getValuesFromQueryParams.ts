import { UrlQueryMap, UrlQueryValue } from '@grafana/data';

interface QueryParamTransform {
  key: string;
  transform?: (param: UrlQueryValue) => any;
}

const defaultTransform = (params: UrlQueryValue): string[] => {
  if (params && params !== undefined && params !== null) {
    return typeof params === 'object' ? params.map((p) => String(p)) : [String(params)];
  }
  return [];
};

export const getValuesFromQueryParams = <T extends any[]>(
  queryParams: UrlQueryMap,
  keys: QueryParamTransform[]
): [...T] => {
  const result: any[] = [];

  keys.forEach(({ key, transform = defaultTransform }) => {
    const param = queryParams[key];

    if (param !== undefined && param !== null) {
      result.push(transform(param));
    }
  });

  return result as any;
};

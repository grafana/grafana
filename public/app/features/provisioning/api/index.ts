import { parseListOptionsSelector } from '../../apiserver/client';
import { ListOptions } from '../../apiserver/types';
export * from './endpoints';

import { generatedAPI } from './endpoints';

export const provisioningAPI = generatedAPI.enhanceEndpoints({
  endpoints: {
    listJob(endpoint) {
      endpoint.query = (queryArg) => ({
        url: `/jobs`,
        params: getListParams(queryArg),
      });
    },
    listRepository(endpoint) {
      endpoint.query = (queryArg) => ({
        url: `/repositories`,
        params: getListParams(queryArg),
      });
    },
  },
});

function getListParams<T extends ListOptions>(queryArg: T | void) {
  if (!queryArg) {
    return undefined;
  }
  const { fieldSelector, labelSelector, ...params } = queryArg;
  return {
    fieldSelector: fieldSelector ? parseListOptionsSelector(fieldSelector) : undefined,
    labelSelector: labelSelector ? parseListOptionsSelector(labelSelector) : undefined,
    ...params,
  };
}

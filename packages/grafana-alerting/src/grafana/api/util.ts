/**
 * @TODO move this to some shared package, currently copied from Grafana core (app/api/utils)
 */

import { config } from '@grafana/runtime';

export const getAPINamespace = () => config.namespace;

export const getAPIBaseURL = (group: string, version: string) => {
  const subPath = config.appSubUrl || '';
  return `${subPath}/apis/${group}/${version}/namespaces/${getAPINamespace()}` as const;
};

// By including the version in the reducer path we can prevent cache bugs when different versions of the API are used for the same entities
export const getAPIReducerPath = (group: string, version: string) => `${group}/${version}` as const;

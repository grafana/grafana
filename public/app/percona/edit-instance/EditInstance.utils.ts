import { Databases } from '../shared/core';
import { DbServicePayload } from '../shared/services/services/Services.types';

import { EditInstanceFormValues } from './EditInstance.types';

export const getService = (result: Record<Databases, DbServicePayload>): DbServicePayload =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  result[Object.keys(result)[0] as Databases];

export const getInitialValues = (service?: DbServicePayload): EditInstanceFormValues => {
  if (service) {
    return {
      ...service,
      custom_labels: fromPayload(service.custom_labels || {}),
    };
  }

  return {
    environment: '',
    cluster: '',
    replication_set: '',
    custom_labels: '',
  };
};

export const fromPayload = (customLabels: Record<string, string>): string =>
  Object.entries(customLabels)
    .map(([label, value]) => label + ':' + value)
    .join('\n');

export const toPayload = (customLabels: string): Record<string, string> =>
  customLabels
    .split(/[\n\s]/)
    .filter(Boolean)
    .reduce((acc: Record<string, string>, val: string) => {
      const [key, value] = val.split(':');

      acc[key] = value;

      return acc;
    }, {});

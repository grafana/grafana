import { Databases } from '../shared/core';
import { CustomLabelsUtils } from '../shared/helpers/customLabels';
import { DbServicePayload } from '../shared/services/services/Services.types';

import { EditInstanceFormValues } from './EditInstance.types';

export const getService = (result: Record<Databases, DbServicePayload>): DbServicePayload =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  result[Object.keys(result)[0] as Databases];

export const getInitialValues = (service?: DbServicePayload): EditInstanceFormValues => {
  if (service) {
    return {
      ...service,
      custom_labels: CustomLabelsUtils.fromPayload(service.custom_labels || {}),
    };
  }

  return {
    environment: '',
    cluster: '',
    replication_set: '',
    custom_labels: '',
  };
};

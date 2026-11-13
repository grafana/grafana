import { faker } from '@faker-js/faker';
import { Factory } from 'fishery';

import {
  API_GROUP,
  API_VERSION,
  type ListTimeIntervalApiResponse,
  type TimeInterval,
} from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';

import { DEFAULT_NAMESPACE, generateResourceVersion } from '../../../../../mocks/util';

export const TimeIntervalFactory = Factory.define<TimeInterval>(({ sequence }) => ({
  kind: 'TimeInterval',
  apiVersion: `${API_GROUP}/${API_VERSION}`,
  metadata: {
    // Differs from spec.name on purpose: rules reference a time interval by its title (spec.name).
    name: `time-interval-uid-${sequence}`,
    namespace: DEFAULT_NAMESPACE,
    resourceVersion: generateResourceVersion(),
    annotations: { 'grafana.com/canUse': 'true' },
  },
  spec: {
    name: `time-interval-${sequence}`,
    time_intervals: [
      {
        weekdays: faker.helpers.arrayElements(['saturday', 'sunday'], { min: 1, max: 2 }),
      },
    ],
  },
}));

export const ListTimeIntervalApiResponseFactory = Factory.define<ListTimeIntervalApiResponse>(() => ({
  kind: 'TimeIntervalList',
  apiVersion: `${API_GROUP}/${API_VERSION}`,
  metadata: {
    resourceVersion: generateResourceVersion(),
  },
  items: TimeIntervalFactory.buildList(3),
}));

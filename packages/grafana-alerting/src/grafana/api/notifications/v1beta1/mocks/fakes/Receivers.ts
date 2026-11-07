import { faker } from '@faker-js/faker';
import { Factory } from 'fishery';

import {
  API_GROUP,
  API_VERSION,
  type ReceiverEmailV1,
  type ReceiverSlackV1,
  type ReceiverWebhookV1,
} from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';

import { DEFAULT_NAMESPACE, generateResourceVersion, generateTitle, generateUID } from '../../../../../mocks/util';
import {
  type ContactPoint,
  type ContactPointMetadataAnnotations,
  type EnhancedListReceiverApiResponse,
} from '../../types';

import { AlertingEntityMetadataAnnotationsFactory } from './common';

export const ListReceiverApiResponseFactory = Factory.define<EnhancedListReceiverApiResponse>(() => ({
  kind: 'ReceiverList',
  apiVersion: `${API_GROUP}/${API_VERSION}`,
  metadata: {
    resourceVersion: generateResourceVersion(),
  },
  items: ContactPointFactory.buildList(5),
}));

export const ContactPointFactory = Factory.define<ContactPoint>(() => {
  const title = generateTitle();

  return {
    kind: 'Receiver',
    apiVersion: `${API_GROUP}/${API_VERSION}`,
    metadata: {
      name: btoa(title),
      namespace: DEFAULT_NAMESPACE,
      uid: generateUID(),
      resourceVersion: generateResourceVersion(),
      annotations: ContactPointMetadataAnnotationsFactory.build(),
    },
    spec: ContactPointSpecFactory.build({ title }),
    status: {},
  };
});

export const ContactPointSpecFactory = Factory.define<ContactPoint['spec']>(() => ({
  title: generateTitle(),
  // two different integrations by default
  integrations: [EmailIntegrationFactory.build(), SlackIntegrationFactory.build()],
}));

export const WebhookIntegrationFactory = Factory.define<ReceiverWebhookV1>(() => ({
  type: 'webhook',
  version: 'v1',
  variant: 'webhook/v1',
  disableResolveMessage: false,
  settings: {
    url: faker.internet.url(),
  },
}));

export const EmailIntegrationFactory = Factory.define<ReceiverEmailV1>(() => ({
  type: 'email',
  version: 'v1',
  variant: 'email/v1',
  settings: {
    addresses: faker.internet.email(),
  },
}));

export const SlackIntegrationFactory = Factory.define<ReceiverSlackV1>(() => ({
  type: 'slack',
  version: 'v1',
  variant: 'slack/v1',
  secureFields: { token: true },
  settings: {
    recipient: '#alerts',
    mentionChannel: 'channel',
  },
}));

// by default the contact points will be in use by a route and a rule
export const ContactPointMetadataAnnotationsFactory = Factory.define<ContactPointMetadataAnnotations>(() => ({
  'grafana.com/access/canReadSecrets': 'true',
  'grafana.com/inUse/routes': '1',
  'grafana.com/inUse/rules': '1',
  'grafana.com/canUse': 'true',
  ...AlertingEntityMetadataAnnotationsFactory.build(),
}));

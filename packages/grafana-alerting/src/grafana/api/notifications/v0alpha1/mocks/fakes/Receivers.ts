import { faker } from '@faker-js/faker';
import { Factory } from 'fishery';

import { DEFAULT_NAMESPACE, generateResourceVersion, generateTitle, generateUID } from '../../../../../mocks/util';
import { GROUP, VERSION } from '../../const';
import {
  ContactPoint,
  ContactPointMetadataAnnotations,
  EnhancedListReceiverApiResponse,
  Integration,
} from '../../types';

import { AlertingEntityMetadataAnnotationsFactory } from './common';

export const ListReceiverApiResponseFactory = Factory.define<EnhancedListReceiverApiResponse>(() => ({
  kind: 'ReceiverList',
  apiVersion: `${GROUP}/${VERSION}`,
  metadata: {},
  items: ContactPointFactory.buildList(5),
}));

export const ContactPointFactory = Factory.define<ContactPoint>(() => {
  const title = generateTitle();

  return {
    metadata: {
      name: btoa(title),
      namespace: DEFAULT_NAMESPACE,
      uid: generateUID(),
      resourceVersion: generateResourceVersion(),
      annotations: ContactPointMetadataAnnotationsFactory.build(),
    },
    spec: ContactPointSpecFactory.build({ title }),
    status: {},
  } satisfies ContactPoint;
});

export const ContactPointSpecFactory = Factory.define<ContactPoint['spec']>(() => ({
  title: generateTitle(),
  // use two unique random integrations by default
  integrations: faker.helpers.uniqueArray(IntegrationUnion, 2).map((integration) => integration.build()),
}));

export const GenericIntegrationFactory = Factory.define<Integration>(() => ({
  type: 'generic',
  disableResolveMessage: false,
  settings: {
    foo: 'bar',
  },
}));

export const EmailIntegrationFactory = Factory.define<Integration>(() => ({
  type: 'email',
  settings: {
    addresses: faker.internet.email(),
  },
}));

export const SlackIntegrationFactory = Factory.define<Integration>(() => ({
  type: 'slack',
  settings: {
    mentionChannel: '#alerts',
  },
}));

const IntegrationUnion = [EmailIntegrationFactory, SlackIntegrationFactory];

// by default the contact points will be in use by a route and a rule
export const ContactPointMetadataAnnotationsFactory = Factory.define<ContactPointMetadataAnnotations>(() => ({
  'grafana.com/access/canReadSecrets': 'true',
  'grafana.com/inUse/routes': '1',
  'grafana.com/inUse/rules': '1',
  ...AlertingEntityMetadataAnnotationsFactory.build(),
}));

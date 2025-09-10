import { faker } from '@faker-js/faker';
import { Factory } from 'fishery';

import { DEFAULT_NAMESPACE, generateResourceVersion, generateTitle, generateUID } from '../../../../mocks/util';
import { ContactPointMetadataAnnotations, ListReceiverApiResponse } from '../../api.gen';
import { GROUP, VERSION } from '../../const';
import { ContactPoint, Integration } from '../../types';

import { AlertingEntityMetadataAnnotationsFactory } from './common';

export const ListReceiverApiResponseFactory = Factory.define<ListReceiverApiResponse>(() => ({
  kind: 'ReceiverList',
  apiVersion: `${GROUP}/${VERSION}`,
  metadata: {},
  items: ContactPointFactory.buildList(5),
}));

export const ContactPointFactory = Factory.define<ContactPoint>(() => {
  const title = generateTitle();

  return {
    apiVersion: `${GROUP}/${VERSION}`,
    kind: 'Receiver',
    metadata: {
      name: btoa(title),
      namespace: DEFAULT_NAMESPACE,
      uid: generateUID(),
      resourceVersion: generateResourceVersion(),
      annotations: ContactPointMetadataAnnotationsFactory.build(),
    },
    spec: ContactPointSpecFactory.build({ title }),
    status: {
      operatorStates: {},
    },
  } satisfies ContactPoint;
});

export const ContactPointSpecFactory = Factory.define<ContactPoint['spec']>(() => ({
  title: generateTitle(),
  // use two unique random integrations by default
  integrations: faker.helpers.uniqueArray(IntegrationUnion, 2).map((integration) => integration.build()),
}));

export const UnknownIntegrationFactory = Factory.define<Integration>(() => ({
  type: 'unknown',
  disableResolveMessage: false,
  version: '1',
  settings: {
    addresses: faker.internet.email(),
  },
}));

export const EmailIntegrationFactory = Factory.define<Integration>(() => ({
  type: 'email',
  version: '1',
  settings: {
    addresses: faker.internet.email(),
  },
}));

export const SlackIntegrationFactory = Factory.define<Integration>(() => ({
  type: 'slack',
  version: '1',
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

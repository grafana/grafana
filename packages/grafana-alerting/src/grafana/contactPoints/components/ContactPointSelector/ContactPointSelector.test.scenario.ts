import { HttpResponse } from 'msw';

import {
  ContactPointFactory,
  ContactPointMetadataAnnotationsFactory,
  EmailIntegrationFactory,
  ListReceiverApiResponseFactory,
  SlackIntegrationFactory,
} from '../../../api/notifications/v0alpha1/mocks/fakes/Receivers';
import { listReceiverHandler } from '../../../api/notifications/v0alpha1/mocks/handlers/ReceiverHandlers/listReceiverHandler';

export const simpleContactPointsList = ListReceiverApiResponseFactory.build({
  items: [
    // contact point with for testing with multiple different integrations – should show "email, slack" description
    ContactPointFactory.build({
      spec: {
        integrations: [EmailIntegrationFactory.build(), SlackIntegrationFactory.build()],
      },
    }),
    // contact point for testing "email (2)" description
    ContactPointFactory.build({
      spec: {
        integrations: EmailIntegrationFactory.buildList(2),
      },
    }),
    // contact point for testing "empty contact point" description
    ContactPointFactory.build({
      spec: { integrations: [] },
    }),
  ],
});

// export the simple contact points list as a separate list of handlers (scenario) so we can load it in the front-end
export const simpleContactPointsListScenario = [listReceiverHandler(simpleContactPointsList)];

export const withErrorScenario = [listReceiverHandler(() => new HttpResponse(null, { status: 500 }))];

// Contact points with different provenances for testing filter functionality
export const contactPointsWithProvenance = ListReceiverApiResponseFactory.build({
  items: [
    // Regular contact point (no provenance / empty provenance)
    ContactPointFactory.build({
      spec: {
        title: 'regular-contact-point',
        integrations: [EmailIntegrationFactory.build()],
      },
      metadata: {
        annotations: ContactPointMetadataAnnotationsFactory.build({
          'grafana.com/provenance': '',
        }),
      },
    }),
    // Imported contact point (converted_prometheus provenance)
    ContactPointFactory.build({
      spec: {
        title: 'imported-contact-point',
        integrations: [SlackIntegrationFactory.build()],
      },
      metadata: {
        annotations: ContactPointMetadataAnnotationsFactory.build({
          'grafana.com/provenance': 'converted_prometheus',
        }),
      },
    }),
    // API provisioned contact point
    ContactPointFactory.build({
      spec: {
        title: 'api-provisioned-contact-point',
        integrations: [EmailIntegrationFactory.build()],
      },
      metadata: {
        annotations: ContactPointMetadataAnnotationsFactory.build({
          'grafana.com/provenance': 'api',
        }),
      },
    }),
  ],
});

export const contactPointsWithProvenanceScenario = [listReceiverHandler(contactPointsWithProvenance)];

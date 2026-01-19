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

// Contact points with different canUse values for testing filter functionality
export const contactPointsWithCanUse = ListReceiverApiResponseFactory.build({
  items: [
    // Regular contact point (canUse: true)
    ContactPointFactory.build({
      spec: {
        title: 'regular-contact-point',
        integrations: [EmailIntegrationFactory.build()],
      },
      metadata: {
        annotations: ContactPointMetadataAnnotationsFactory.build({
          'grafana.com/provenance': '',
          'grafana.com/canUse': 'true',
        }),
      },
    }),
    // Imported contact point (canUse: false)
    ContactPointFactory.build({
      spec: {
        title: 'imported-contact-point',
        integrations: [SlackIntegrationFactory.build()],
      },
      metadata: {
        annotations: ContactPointMetadataAnnotationsFactory.build({
          'grafana.com/provenance': 'converted_prometheus',
          'grafana.com/canUse': 'false',
        }),
      },
    }),
    // API provisioned contact point (canUse: true)
    ContactPointFactory.build({
      spec: {
        title: 'api-provisioned-contact-point',
        integrations: [EmailIntegrationFactory.build()],
      },
      metadata: {
        annotations: ContactPointMetadataAnnotationsFactory.build({
          'grafana.com/provenance': 'api',
          'grafana.com/canUse': 'true',
        }),
      },
    }),
  ],
});

/** @deprecated Use contactPointsWithCanUse instead */
export const contactPointsWithProvenance = contactPointsWithCanUse;

export const contactPointsWithCanUseScenario = [listReceiverHandler(contactPointsWithCanUse)];

/** @deprecated Use contactPointsWithCanUseScenario instead */
export const contactPointsWithProvenanceScenario = contactPointsWithCanUseScenario;

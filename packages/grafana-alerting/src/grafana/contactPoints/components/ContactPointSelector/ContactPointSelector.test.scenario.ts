import {
  ContactPointFactory,
  EmailIntegrationFactory,
  ListReceiverApiResponseFactory,
  SlackIntegrationFactory,
} from '../../../api/v0alpha1/mocks/fakes/Receivers';
import { listReceiverHandler } from '../../../api/v0alpha1/mocks/handlers/ReceiverHandlers';

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

// the default export will allow us to load this scenario on the front-end using the MSW web worker
export default simpleContactPointsListScenario;

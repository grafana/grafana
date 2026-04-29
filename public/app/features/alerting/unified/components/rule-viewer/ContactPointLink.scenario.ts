import {
  ContactPointFactory,
  EmailIntegrationFactory,
  ListReceiverApiResponseFactory,
  SlackIntegrationFactory,
  listReceiverHandler,
} from '@grafana/alerting/testing';

export const RECEIVER_NAME = 'my-receiver';
export const RECEIVER_UID = 'my-receiver';

// single response scenario
export const listContactPointsResponse = ListReceiverApiResponseFactory.build({
  items: [
    ContactPointFactory.build({
      metadata: {
        name: RECEIVER_UID,
      },
      spec: {
        title: RECEIVER_NAME,
        integrations: [EmailIntegrationFactory.build(), SlackIntegrationFactory.build()],
      },
    }),
  ],
});
export const listContactPointsScenario = [listReceiverHandler(listContactPointsResponse)];

// empty response scenario
export const listContactPointEmptyResponse = ListReceiverApiResponseFactory.build({
  items: [],
});
export const listContactPointsEmptyResponseScenario = [listReceiverHandler(listContactPointEmptyResponse)];

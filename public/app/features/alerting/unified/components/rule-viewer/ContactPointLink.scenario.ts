import {
  ContactPointFactory,
  EmailIntegrationFactory,
  ListReceiverApiResponseFactory,
  SlackIntegrationFactory,
  listReceiverHandler,
} from '@grafana/alerting/testing';

export const RECEIVER_NAME = 'my-receiver';
// deliberately unrelated to the receiver's title, since the UID is a persisted identifier
export const RECEIVER_UID = 'rcv-abc123';

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
const listContactPointEmptyResponse = ListReceiverApiResponseFactory.build({
  items: [],
});
export const listContactPointsEmptyResponseScenario = [listReceiverHandler(listContactPointEmptyResponse)];

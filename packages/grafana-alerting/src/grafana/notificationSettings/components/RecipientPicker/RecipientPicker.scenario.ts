import { HttpResponse } from 'msw';

import {
  ContactPointFactory,
  ListReceiverApiResponseFactory,
} from '../../../api/notifications/v1beta1/mocks/fakes/Receivers';
import {
  ListRoutingTreeApiResponseFactory,
  RoutingTreeFactory,
} from '../../../api/notifications/v1beta1/mocks/fakes/Routes';
import { ListTimeIntervalApiResponseFactory } from '../../../api/notifications/v1beta1/mocks/fakes/TimeIntervals';
import { listReceiverHandler } from '../../../api/notifications/v1beta1/mocks/handlers/ReceiverHandlers/listReceiverHandler';
import { listRoutingTreeHandler } from '../../../api/notifications/v1beta1/mocks/handlers/RoutingTreeHandlers/listRoutingTreeHandler';
import { listTimeIntervalHandler } from '../../../api/notifications/v1beta1/mocks/handlers/TimeIntervalHandlers/listTimeIntervalHandler';
import { USER_DEFINED_TREE_NAME } from '../../../notificationPolicies/routingTrees';

export const slackOncallContactPoint = ContactPointFactory.build({ spec: { title: 'slack-oncall' } });

export const contactPointsListScenario = [
  listReceiverHandler(ListReceiverApiResponseFactory.build({ items: [slackOncallContactPoint] })),
];

export const contactPointsErrorScenario = [listReceiverHandler(() => new HttpResponse(null, { status: 500 }))];

export const deploymentToolsRoutingTree = RoutingTreeFactory.build({ metadata: { name: 'deployment-tools' } });

export const routingTreesListScenario = [
  listRoutingTreeHandler(
    ListRoutingTreeApiResponseFactory.build({
      items: [RoutingTreeFactory.build({ metadata: { name: USER_DEFINED_TREE_NAME } }), deploymentToolsRoutingTree],
    })
  ),
];

export const routingTreesErrorScenario = [listRoutingTreeHandler(() => new HttpResponse(null, { status: 500 }))];

export const emptyTimeIntervalsScenario = [
  listTimeIntervalHandler(ListTimeIntervalApiResponseFactory.build({ items: [] })),
];

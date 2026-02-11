import { HttpResponse } from 'msw';

import {
  ListRoutingTreeApiResponseFactory,
  RoutingTreeFactory,
} from '../../../api/notifications/v0alpha1/mocks/fakes/Routes';
import { listRoutingTreeHandler } from '../../../api/notifications/v0alpha1/mocks/handlers/RoutingTreeHandlers/listRoutingTreeHandler';
import { USER_DEFINED_TREE_NAME } from '../../consts';

// A simple list with the default tree and two custom trees
export const simpleRoutingTreesList = ListRoutingTreeApiResponseFactory.build({
  items: [
    RoutingTreeFactory.build({
      metadata: { name: USER_DEFINED_TREE_NAME },
    }),
    RoutingTreeFactory.build({
      metadata: { name: 'team-platform' },
    }),
    RoutingTreeFactory.build({
      metadata: { name: 'team-backend' },
    }),
  ],
});

export const simpleRoutingTreesListScenario = [listRoutingTreeHandler(simpleRoutingTreesList)];

// A list with only the default tree (feature toggle off or no custom trees)
export const singleDefaultTreeList = ListRoutingTreeApiResponseFactory.build({
  items: [
    RoutingTreeFactory.build({
      metadata: { name: USER_DEFINED_TREE_NAME },
    }),
  ],
});

export const singleDefaultTreeScenario = [listRoutingTreeHandler(singleDefaultTreeList)];

export const routingTreeWithErrorScenario = [listRoutingTreeHandler(() => new HttpResponse(null, { status: 500 }))];

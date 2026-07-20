import { HttpResponse } from 'msw';

import {
  ListRoutingTreeApiResponseFactory,
  RoutingTreeFactory,
} from '../../../api/notifications/v0alpha1/mocks/fakes/Routes';
import { listRoutingTreeHandler } from '../../../api/notifications/v0alpha1/mocks/handlers/RoutingTreeHandlers/listRoutingTreeHandler';
import { DEFAULT_ROUTING_TREE_NAME_ALIAS, USER_DEFINED_TREE_NAME } from '../../routingTrees';

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

// The same simple list, but the default tree is presented with the future canonical name (`default`),
// modelling a backend that emits `default` for the root tree. `billing` sorts alphabetically BEFORE
// `default`, so the default tree only ends up first if it is recognised and force-sorted (not merely alphabetical).
export const simpleRoutingTreesListDefaultAlias = ListRoutingTreeApiResponseFactory.build({
  items: [
    RoutingTreeFactory.build({ metadata: { name: DEFAULT_ROUTING_TREE_NAME_ALIAS } }),
    RoutingTreeFactory.build({ metadata: { name: 'billing' } }),
    RoutingTreeFactory.build({ metadata: { name: 'team-backend' } }),
  ],
});

export const simpleRoutingTreesListDefaultAliasScenario = [listRoutingTreeHandler(simpleRoutingTreesListDefaultAlias)];

export const routingTreeWithErrorScenario = [listRoutingTreeHandler(() => new HttpResponse(null, { status: 500 }))];

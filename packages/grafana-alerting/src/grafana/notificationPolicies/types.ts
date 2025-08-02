import { OverrideProperties } from 'type-fest';

import { RoutingTreeRoute } from '../api/v0alpha1/api.gen';
import { LabelMatcher } from '../matchers/types';

// type-narrow the route tree
export type Route = OverrideProperties<
  RoutingTreeRoute,
  {
    matchers: LabelMatcher[];
    routes: Route[];
  }
>;

import { OverrideProperties } from 'type-fest';

import { RoutingTreeMatcher } from '../api/notifications/v0alpha1/notifications.api.gen';

export type Label = [string, string];

// type-narrow the matchers the specify exact allowed set of operators
export type LabelMatcher = OverrideProperties<
  RoutingTreeMatcher,
  {
    type: '=' | '!=' | '=~' | '!~';
  }
>;

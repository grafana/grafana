import { OverrideProperties } from 'type-fest';

import { RoutingTreeMatcher } from '../api/v0alpha1/api.gen';

export type Label = [string, string];

// type-narrow the matchers the specify exact allowed set of operators
export type LabelMatcher = OverrideProperties<
  RoutingTreeMatcher,
  {
    type: '=' | '!=' | '=~' | '!~';
  }
>;

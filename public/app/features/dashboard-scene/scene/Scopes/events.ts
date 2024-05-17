import { BusEventWithPayload, Scope } from '@grafana/data';

import { ScopesFiltersBaseSelectorSceneState } from './ScopesFiltersBaseSelectorScene';

export class ScopesUpdate extends BusEventWithPayload<Scope[]> {
  static type = 'scopes-updated';
}

export class ScopesFiltersOpenAdvanced extends BusEventWithPayload<
  Pick<ScopesFiltersBaseSelectorSceneState, 'nodes' | 'expandedNodes' | 'scopes'>
> {
  static type = 'scopes-filters-open-advanced';
}

export class ScopesFiltersSaveAdvanced extends BusEventWithPayload<
  Pick<ScopesFiltersBaseSelectorSceneState, 'nodes' | 'expandedNodes' | 'scopes'>
> {
  static type = 'scopes-filters-close-advanced';
}

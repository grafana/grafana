import { type SelectableValue } from '@grafana/data';
import {
  type AdHocFiltersControllerState,
  type AdHocFiltersVariable,
  AdHocFiltersVariableController,
} from '@grafana/scenes';

import { getPinnedFilters, isPinnedFilter } from './pinnedFilters';

/**
 * Controller for the bulk filters combobox when pinned filters are enabled. Pinned filters are
 * rendered as separate standalone controls, so they are stripped from the combobox pills and
 * their keys are removed from the key suggestions.
 */
export class PinnedAwareFiltersController extends AdHocFiltersVariableController {
  public constructor(private variable: AdHocFiltersVariable) {
    super(variable);
  }

  public useState(): AdHocFiltersControllerState {
    const state = super.useState();

    return {
      ...state,
      originFilters: state.originFilters?.filter((filter) => !isPinnedFilter(filter)),
    };
  }

  public async getKeys(currentKey: string | null): Promise<Array<SelectableValue<string>>> {
    const keys = await super.getKeys(currentKey);
    const pinnedKeys = new Set(getPinnedFilters(this.variable.state.originFilters).map((filter) => filter.key));

    return keys.filter((key) => key.value == null || !pinnedKeys.has(key.value));
  }
}

import { SelectableValue } from '@grafana/data';
import { AdHocFiltersVariable, QueryVariable, sceneGraph, SceneObject } from '@grafana/scenes';

import { VAR_FILTERS } from '../shared';

export function getLabelOptions(scenObject: SceneObject, variable: QueryVariable) {
  const labelFilters = sceneGraph.lookupVariable(VAR_FILTERS, scenObject);
  const labelOptions: Array<SelectableValue<string>> = [];

  if (!(labelFilters instanceof AdHocFiltersVariable)) {
    return [];
  }

  const filters = labelFilters.state.filters;

  for (const option of variable.getOptionsForSelect()) {
    const filterExists = filters.find((f) => f.key === option.value);
    if (!filterExists) {
      labelOptions.push({ label: option.label, value: String(option.value) });
    }
  }

  return labelOptions;
}

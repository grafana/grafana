import { getDataSourceInstanceSettings } from '@grafana/runtime';
import { AdHocFiltersVariable, type SceneObject } from '@grafana/scenes';

function applySupportsMultiValueOperators(variable: AdHocFiltersVariable) {
  const datasourceType = variable.state.datasource?.type;
  void getDataSourceInstanceSettings({ type: datasourceType })
    .then((settings) => {
      const supports = Boolean(settings?.meta.multiValueFilterOperators);
      if (variable.state.supportsMultiValueOperators !== supports) {
        variable.setState({ supportsMultiValueOperators: supports });
      }
    })
    .catch((e) => console.warn('Failed to resolve multi-value operator support', datasourceType, e));
}

// A stateless behavior survives the state clones that dashboard swaps install. A lookup started
// at build time would land on the variable it started for, which a swap discards.
export function resolveMultiValueOperatorsOnActivate(variable: SceneObject) {
  if (variable instanceof AdHocFiltersVariable) {
    applySupportsMultiValueOperators(variable);
  }
}

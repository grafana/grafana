import { getDataSourceInstanceSettings } from '@grafana/runtime';
import { type AdHocFiltersVariable } from '@grafana/scenes';

// A stateless behavior survives the state clones that dashboard swaps install. A lookup started
// at build time would land on the variable it started for, which a swap discards.
export function resolveMultiValueOperatorsOnActivate(variable: AdHocFiltersVariable) {
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

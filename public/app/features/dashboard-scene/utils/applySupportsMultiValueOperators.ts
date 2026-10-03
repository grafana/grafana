import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type AdHocFiltersVariable } from '@grafana/scenes';

// Keep dashboard-load construction synchronous while the instance-settings lookup is async.
export function applySupportsMultiValueOperators(variable: AdHocFiltersVariable, datasourceType?: string) {
  void getDataSourceInstanceSettings({ type: datasourceType })
    .then((settings) => {
      const supports = Boolean(settings?.meta.multiValueFilterOperators);
      if (variable.state.supportsMultiValueOperators !== supports) {
        variable.setState({ supportsMultiValueOperators: supports });
      }
    })
    .catch((e) => console.warn('Failed to resolve multi-value operator support', datasourceType, e));
}

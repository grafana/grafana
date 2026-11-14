import { getDataSourceInstanceSettings } from '@grafana/runtime';
import { AdHocFiltersVariable, sceneGraph, type SceneObject } from '@grafana/scenes';

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

// A build starts the lookup on the variables it makes. A caller that installs clones of the built
// state must look it up again on the clones, or the result lands on the discarded tree.
export function resolveAdHocMultiValueOperators(root: SceneObject) {
  for (const variable of sceneGraph.findAllObjects(root, (obj) => obj instanceof AdHocFiltersVariable)) {
    if (variable instanceof AdHocFiltersVariable) {
      applySupportsMultiValueOperators(variable, variable.state.datasource?.type);
    }
  }
}

import { SceneDataLayerProvider, sceneGraph } from '@grafana/scenes';

import { isDashboardDataLayerSetState } from './DashboardDataLayerSet';
import { DashboardScene } from './DashboardScene';
import { DataLayerControl } from './DataLayerControl';

// Renders data layer controls for a dashboard
export function DashboardDataLayerControls({ dashboard }: { dashboard: DashboardScene }) {
  // We are not using the default renderer of the data objects here, because the information of where the controls
  // should be rendered (`.placement`) are set on the underlying annotation layer objects.
  const state = sceneGraph.getData(dashboard).useState();
  // It is possible to render the controls for the annotation data layers in separate places using the `placement` property.
  // In case it's not specified, we are rendering the controls here (default).
  const isDefaultPlacement = (layer: SceneDataLayerProvider) => layer.state.placement === undefined;

  if (isDashboardDataLayerSetState(state)) {
    return (
      <>
        {state.annotationLayers.filter(isDefaultPlacement).map((layer) => (
          <DataLayerControl layer={layer} key={layer.state.key} />
        ))}
      </>
    );
  }

  return null;
}

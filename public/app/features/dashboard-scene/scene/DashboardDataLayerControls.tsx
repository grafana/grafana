import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneDataLayerProvider, sceneGraph } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

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
  const isDefaultPlacementAndNotHidden = (layer: SceneDataLayerProvider) =>
    layer.state.placement === undefined && !layer.state.isHidden;
  const styles = useStyles2(getStyles);

  if (isDashboardDataLayerSetState(state)) {
    return (
      <>
        {state.annotationLayers.filter(isDefaultPlacementAndNotHidden).map((layer) => (
          <div key={layer.state.key} className={styles.container}>
            <DataLayerControl layer={layer} />
          </div>
        ))}
      </>
    );
  }

  return null;
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    label: 'dashboard-data-layer-controls',
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
  }),
});

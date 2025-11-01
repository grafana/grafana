import { css } from '@emotion/css';

import { LoadingState, GrafanaTheme2 } from '@grafana/data';
import { ControlsLabel, SceneDataLayerProvider, sceneGraph } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { isDashboardDataLayerSetState } from './DashboardDataLayerSet';
import { DashboardScene } from './DashboardScene';

export function DataLayerControls({ dashboard }: { dashboard: DashboardScene }) {
  // Currently we are only rendering the annotation data layers
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

// Renders the controls for a single data layer
export function DataLayerControl({ layer, inMenu }: { layer: SceneDataLayerProvider; inMenu?: boolean }) {
  const elementId = `data-layer-${layer.state.key}`;
  const { data, isHidden } = layer.useState();
  const showLoading = Boolean(data && data.state === LoadingState.Loading);
  const styles = useStyles2(getStyles);

  if (isHidden) {
    return null;
  }

  if (inMenu) {
    return (
      <div className={styles.menuContainer}>
        <div className={styles.controlWrapper}>
          <layer.Component model={layer} />
        </div>
        <ControlsLabel
          htmlFor={elementId}
          isLoading={showLoading}
          onCancel={() => layer.cancelQuery?.()}
          label={layer.state.name}
          description={layer.state.description}
          error={layer.state.data?.errors?.[0].message}
          layout={'vertical'}
          className={styles.menuLabel}
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <ControlsLabel
        htmlFor={elementId}
        isLoading={showLoading}
        onCancel={() => layer.cancelQuery?.()}
        label={layer.state.name}
        description={layer.state.description}
        error={layer.state.data?.errors?.[0].message}
      />
      <layer.Component model={layer} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
  }),
  menuContainer: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  controlWrapper: css({
    '& > div': {
      border: 'none',
      background: 'transparent',
      '&:hover': {
        border: 'none',
        background: 'transparent',
      },
    },
  }),
  menuLabel: css({
    marginTop: theme.spacing(0.5),
  }),
});

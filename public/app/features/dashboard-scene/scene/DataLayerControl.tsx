import { css } from '@emotion/css';

import { LoadingState, GrafanaTheme2 } from '@grafana/data';
import { ControlsLabel, SceneDataLayerProvider } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

export type Props = {
  layer: SceneDataLayerProvider;
  // Set to true if the control is rendered inside a drop-down menu
  inMenu?: boolean;
};

// Renders the controls for a single data layer
export function DataLayerControl({ layer, inMenu }: Props) {
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
      paddingRight: theme.spacing(0.5),
      height: theme.spacing(2),
      '&:hover': {
        border: 'none',
        background: 'transparent',
      },
    },
  }),
  menuLabel: css({
    marginTop: 0,
    marginBottom: 0,
  }),
});

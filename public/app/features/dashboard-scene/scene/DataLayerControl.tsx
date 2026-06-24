import { css, cx } from '@emotion/css';

import { type GrafanaTheme2, LoadingState } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ControlsLabel, dataLayers, type SceneDataLayerProvider } from '@grafana/scenes';
import { useElementSelection, useStyles2 } from '@grafana/ui';

export type Props = {
  layer: SceneDataLayerProvider;
  inMenu?: boolean;
};

// Renders the controls for a single data layer
export function DataLayerControl({ layer, inMenu }: Props) {
  const elementId = `data-layer-${layer.state.key}`;
  const { data } = layer.useState();
  const { isSelected, isSelectable } = useElementSelection(layer.state.key);
  const showLoading = Boolean(data && data.state === LoadingState.Loading);
  const styles = useStyles2(getStyles);

  const label: string =
    layer instanceof dataLayers.AnnotationsDataLayer && Boolean(layer.state.query.builtIn)
      ? t('dashboard-scene.annotation-settings-list.built-in', '{{annoName}} (Built-in)', {
          annoName: layer.state.name,
          interpolation: { escapeValue: false },
        })
      : layer.state.name;

  if (inMenu) {
    return (
      <div
        className={cx(
          styles.menuContainer,
          isSelected && 'dashboard-selected-element',
          isSelectable && !isSelected && 'dashboard-selectable-element'
        )}
      >
        <div className={styles.controlWrapper}>
          <layer.Component model={layer} />
        </div>
        <ControlsLabel
          htmlFor={isSelectable ? undefined : elementId}
          isLoading={showLoading}
          onCancel={() => layer.cancelQuery?.()}
          label={label}
          description={layer.state.description}
          error={layer.state.data?.errors?.[0].message}
          layout={'vertical'}
          className={cx(styles.menuLabel, isSelectable && styles.labelSelectable)}
        />
      </div>
    );
  }

  return (
    <div
      className={cx(
        styles.container,
        isSelected && 'dashboard-selected-element',
        isSelectable && !isSelected && 'dashboard-selectable-element'
      )}
    >
      <ControlsLabel
        htmlFor={isSelectable ? undefined : elementId}
        isLoading={showLoading}
        onCancel={() => layer.cancelQuery?.()}
        label={label}
        description={layer.state.description}
        error={layer.state.data?.errors?.[0].message}
        className={cx(isSelectable && styles.labelSelectable)}
      />
      <layer.Component model={layer} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    alignItems: 'center',
  }),
  menuContainer: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
  }),
  controlWrapper: css({
    height: theme.spacing(2),
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
  labelSelectable: css({
    cursor: 'pointer',
  }),
});

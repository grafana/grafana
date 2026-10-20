import { css, cx } from '@emotion/css';

import { type GrafanaTheme2, LoadingState } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ControlsLabel, dataLayers, type SceneDataLayerProvider } from '@grafana/scenes';
import { InlineSwitch, useElementSelection, useStyles2 } from '@grafana/ui';

import { isAnnotationLabelHidden } from '../settings/annotations/annotationDisplay';

import type { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';
import { setAnnotationLayerEnabled } from './annotationLayerEnabled';

export type Props = {
  layer: SceneDataLayerProvider;
  /**
   * Layer the enable switch edits. Section controls pass the repeat source so a toggle
   * on a clone persists. Omit it to keep the layer's own switch.
   */
  enabledLayer?: DashboardAnnotationsDataLayer;
  inMenu?: boolean;
};

// Renders the controls for a single data layer
export function DataLayerControl({ layer, enabledLayer, inMenu }: Props) {
  const elementId = `data-layer-${layer.state.key}`;
  const { data } = layer.useState();
  const { isEnabled, isHidden } = (enabledLayer ?? layer).useState();
  const { isSelected, isSelectable } = useElementSelection(layer.state.key);
  const showLoading = Boolean(data && data.state === LoadingState.Loading);
  const styles = useStyles2(getStyles);
  const elementType = layer instanceof dataLayers.AnnotationsDataLayer ? 'annotation' : 'data-layer';

  const hideLabel = layer instanceof dataLayers.AnnotationsDataLayer && isAnnotationLabelHidden(layer.state.query);
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
        data-dashboard-element-key={layer.state.key}
        data-dashboard-element-type={elementType}
      >
        <div className={styles.controlWrapper}>
          <LayerEnableControl
            layer={layer}
            enabledLayer={enabledLayer}
            elementId={elementId}
            isEnabled={isEnabled}
            isHidden={isHidden}
          />
        </div>
        {!hideLabel && (
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
        )}
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
      data-dashboard-element-key={layer.state.key}
      data-dashboard-element-type={elementType}
    >
      {!hideLabel && (
        <ControlsLabel
          htmlFor={isSelectable ? undefined : elementId}
          isLoading={showLoading}
          onCancel={() => layer.cancelQuery?.()}
          label={label}
          description={layer.state.description}
          error={layer.state.data?.errors?.[0].message}
          className={cx(isSelectable && styles.labelSelectable)}
        />
      )}
      <LayerEnableControl
        layer={layer}
        enabledLayer={enabledLayer}
        elementId={elementId}
        isEnabled={isEnabled}
        isHidden={isHidden}
      />
    </div>
  );
}

function LayerEnableControl({
  layer,
  enabledLayer,
  elementId,
  isEnabled,
  isHidden,
}: {
  layer: SceneDataLayerProvider;
  enabledLayer?: DashboardAnnotationsDataLayer;
  elementId: string;
  isEnabled: boolean;
  isHidden: boolean;
}) {
  const styles = useStyles2(getStyles);

  // The scenes switch writes the model it is given. On a repeat clone that change is discarded,
  // so section controls bind the switch to the source layer instead.
  if (enabledLayer) {
    if (isHidden) {
      return null;
    }

    return (
      <InlineSwitch
        className={styles.switch}
        id={elementId}
        value={isEnabled}
        onChange={() => setAnnotationLayerEnabled(enabledLayer, !isEnabled)}
      />
    );
  }

  return <layer.Component model={layer} />;
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
  switch: css({
    borderBottomLeftRadius: 'unset',
    borderTopLeftRadius: 'unset',
  }),
});

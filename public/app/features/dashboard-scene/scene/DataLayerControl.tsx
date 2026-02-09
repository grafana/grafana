import { css, cx } from '@emotion/css';
import { useCallback } from 'react';

import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { ControlsLabel, dataLayers, SceneDataLayerProvider } from '@grafana/scenes';
import { InlineSwitch, useElementSelection, useStyles2 } from '@grafana/ui';

export type Props = {
  layer: SceneDataLayerProvider;
  inMenu?: boolean;
  isEditingNewLayouts?: boolean;
};

// Renders the controls for a single data layer
export function DataLayerControl({ layer, inMenu, isEditingNewLayouts }: Props) {
  const elementId = `data-layer-${layer.state.key}`;
  const { data, isHidden, isEnabled } = layer.useState();
  const { isSelected, onSelect, isSelectable } = useElementSelection(layer.state.key);
  const showLoading = Boolean(data && data.state === LoadingState.Loading);
  const styles = useStyles2(getStyles);
  const onHiddenToggleChange = useCallback(() => {
    if (layer instanceof dataLayers.AnnotationsDataLayer) {
      layer.setState({
        isEnabled: !isEnabled,
        query: { ...layer.state.query, enable: !isEnabled },
      });
    } else {
      layer.setState({ isEnabled: !isEnabled });
    }
  }, [isEnabled, layer]);

  const shouldShowHidden = isEditingNewLayouts && isHidden;

  if (isHidden && !isEditingNewLayouts) {
    return null;
  }

  // When isHidden is true, layer.Component returns null, so we render our own switch
  const switchComponent = shouldShowHidden ? (
    <InlineSwitch className={styles.switch} id={elementId} value={isEnabled} onChange={onHiddenToggleChange} />
  ) : (
    <layer.Component model={layer} />
  );

  const onPointerDown = (evt: React.PointerEvent) => {
    if (!isSelectable) {
      return;
    }

    // Ignore click if it's inside the switch control (has a label with for=elementId)
    // The ControlsLabel has no htmlFor when selectable, so clicks on it won't match
    if (evt.target instanceof Element) {
      const forAttribute = evt.target.closest('label[for]')?.getAttribute('for');

      if (forAttribute === elementId) {
        evt.stopPropagation();
        return;
      }
    }

    if (isSelectable && onSelect) {
      evt.stopPropagation();
      onSelect(evt);
    }
  };

  if (inMenu) {
    return (
      <div
        className={cx(
          styles.menuContainer,
          shouldShowHidden && styles.hidden,
          isSelected && 'dashboard-selected-element',
          isSelectable && !isSelected && 'dashboard-selectable-element'
        )}
        onPointerDown={onPointerDown}
      >
        <div className={styles.controlWrapper}>{switchComponent}</div>
        <ControlsLabel
          htmlFor={isSelectable ? undefined : elementId}
          isLoading={showLoading}
          onCancel={() => layer.cancelQuery?.()}
          label={layer.state.name}
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
        shouldShowHidden && styles.hidden,
        isSelected && 'dashboard-selected-element',
        isSelectable && !isSelected && 'dashboard-selectable-element'
      )}
      onPointerDown={onPointerDown}
    >
      <ControlsLabel
        htmlFor={isSelectable ? undefined : elementId}
        isLoading={showLoading}
        onCancel={() => layer.cancelQuery?.()}
        label={layer.state.name}
        description={layer.state.description}
        error={layer.state.data?.errors?.[0].message}
        className={cx(isSelectable && styles.labelSelectable)}
      />
      {switchComponent}
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
  hidden: css({
    opacity: 0.6,
    '&:hover': css({
      opacity: 1,
    }),
    label: css({
      textDecoration: 'line-through',
    }),
  }),
  switch: css({
    borderBottomLeftRadius: 'unset',
    borderTopLeftRadius: 'unset',
  }),
});

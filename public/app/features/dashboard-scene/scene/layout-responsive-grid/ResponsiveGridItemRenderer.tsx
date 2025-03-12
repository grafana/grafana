import { css } from '@emotion/css';
import classNames from 'classnames';
import { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { LayoutOrchestrator } from '../layout-manager/LayoutOrchestrator';
import { closestOfType } from '../layout-manager/utils';

import { ResponsiveGridItem } from './ResponsiveGridItem';

export interface ResponsiveGridItemProps extends SceneComponentProps<ResponsiveGridItem> {}

export function ResponsiveGridItemRenderer({ model }: ResponsiveGridItemProps) {
  const { body } = model.useState();
  const styles = useStyles2(getStyles);
  const layoutOrchestrator = closestOfType(model, (s) => s instanceof LayoutOrchestrator);
  const { activeLayoutItemRef } = layoutOrchestrator!.useState();
  const activeLayoutItem = activeLayoutItemRef?.resolve();
  const isDragging = model === activeLayoutItem;

  useEffect(() => {
    // Compute and cache the grid item's bounding box.
    // Don't re-calculate while an item is being dragged.
    if (!activeLayoutItem) {
      model.cachedBoundingBox = model.computeBoundingBox();
    }
  });

  const dragStyles =
    isDragging && layoutOrchestrator && model.cachedBoundingBox
      ? {
          width: model.cachedBoundingBox.right - model.cachedBoundingBox.left,
          height: model.cachedBoundingBox.bottom - model.cachedBoundingBox.top,
          translate: `${-layoutOrchestrator.dragOffset.left}px ${-layoutOrchestrator.dragOffset.top}px`,
          // --x/y-pos are set in LayoutOrchestrator
          transform: `translate(var(--x-pos), var(--y-pos))`,
        }
      : {};

  return model.state.repeatedPanels ? (
    <>
      {model.state.repeatedPanels.map((item) => (
        <div className={styles.wrapper} key={item.state.key}>
          <item.Component model={item} />
        </div>
      ))}
    </>
  ) : (
    <div
      className={classNames(styles.wrapper, { [styles.dragging]: isDragging })}
      style={dragStyles}
      ref={model.containerRef}
    >
      <body.Component model={body} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'grid',
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  }),
  dragging: css({
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: theme.zIndex.portal + 1,
    pointerEvents: 'none',
  }),
});

import { css } from '@emotion/css';
import classNames from 'classnames';
import { useLayoutEffect } from 'react';

import { SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { LayoutOrchestrator } from '../layout-manager/LayoutOrchestrator';
import { closestOfType } from '../layout-manager/utils';

import { ResponsiveGridItem } from './ResponsiveGridItem';

export interface ResponsiveGridItemProps extends SceneComponentProps<ResponsiveGridItem> {
  order: number;
}

export function ResponsiveGridItemRenderer({ model, order }: ResponsiveGridItemProps) {
  const { body, isHidden } = model.useState();
  const styles = useStyles2(getStyles);
  const layoutOrchestrator = closestOfType(model, (s) => s instanceof LayoutOrchestrator);
  const { activeLayoutItemRef } = layoutOrchestrator!.useState();
  const activeLayoutItem = activeLayoutItemRef?.resolve();
  const isDragging = model === activeLayoutItem;

  useLayoutEffect(() => {
    console.log(`Storing bounding box for grid item ${model.state.key}`);
    // Compute and cache the grid item's bounding box.
    // Don't re-calculate while an item is being dragged.
    if (!activeLayoutItem) {
      model.cachedBoundingBox = model.computeBoundingBox();
    }
  });

  const dragStyles =
    isDragging && model.cachedBoundingBox
      ? {
          width: model.cachedBoundingBox.right - model.cachedBoundingBox.left,
          height: model.cachedBoundingBox.bottom - model.cachedBoundingBox.top,
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
      data-order={isHidden ? -1 : order}
      className={classNames(styles.wrapper, { [styles.dragging]: isDragging })}
      style={{ order, ...dragStyles }}
      ref={model.containerRef}
    >
      <body.Component model={body} />
    </div>
  );
}

const getStyles = () => ({
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
    width: '200px',
    height: '200px',
  }),
});

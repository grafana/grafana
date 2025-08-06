import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data/';
import { LazyLoader, SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { useIsConditionallyHidden } from '../../conditional-rendering/useIsConditionallyHidden';
import { useDashboardState } from '../../utils/utils';
import { getIsLazy } from '../layouts-shared/utils';

import { AutoGridItem } from './AutoGridItem';
import { DRAGGED_ITEM_HEIGHT, DRAGGED_ITEM_LEFT, DRAGGED_ITEM_TOP, DRAGGED_ITEM_WIDTH } from './const';

export function AutoGridItemRenderer({ model }: SceneComponentProps<AutoGridItem>) {
  const { body, repeatedPanels, key } = model.useState();
  const { draggingKey } = model.getParentGrid().useState();
  const { isEditing, preload } = useDashboardState(model);
  const [isConditionallyHidden, conditionalRenderingClass, conditionalRenderingOverlay] =
    useIsConditionallyHidden(model);
  const styles = useStyles2(getStyles);

  const isLazy = useMemo(() => getIsLazy(preload), [preload]);

  if (isConditionallyHidden && !isEditing) {
    return null;
  }

  const isDragging = !!draggingKey;
  const isDragged = draggingKey === key;

  return repeatedPanels ? (
    <>
      {repeatedPanels.map((item) =>
        isLazy ? (
          <LazyLoader key={item.state.key!} className={cx(conditionalRenderingClass, styles.wrapper)}>
            <item.Component model={item} />
            {conditionalRenderingOverlay}
          </LazyLoader>
        ) : (
          <div className={cx(conditionalRenderingClass, styles.wrapper)} key={item.state.key}>
            <item.Component model={item} />
            {conditionalRenderingOverlay}
          </div>
        )
      )}
    </>
  ) : isLazy ? (
    <div ref={model.containerRef} data-auto-grid-item-drop-target={isDragging ? key : undefined}>
      {isDragged && <div className={styles.draggedPlaceholder} />}
      <LazyLoader
        key={body.state.key!}
        className={cx(!isDragged && conditionalRenderingClass, styles.wrapper, isDragged && styles.draggedWrapper)}
      >
        <body.Component model={body} />
        {conditionalRenderingOverlay}
      </LazyLoader>
    </div>
  ) : (
    <div ref={model.containerRef} data-auto-grid-item-drop-target={isDragging ? key : undefined}>
      {isDragged && <div className={styles.draggedPlaceholder} />}

      <div className={cx(!isDragged && conditionalRenderingClass, styles.wrapper, isDragged && styles.draggedWrapper)}>
        <body.Component model={body} />
        {conditionalRenderingOverlay}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({ width: '100%', height: '100%', position: 'relative' }),
  draggedWrapper: css({
    position: 'absolute',
    zIndex: 1000,
    top: `var(${DRAGGED_ITEM_TOP})`,
    left: `var(${DRAGGED_ITEM_LEFT})`,
    width: `var(${DRAGGED_ITEM_WIDTH})`,
    height: `var(${DRAGGED_ITEM_HEIGHT})`,
    opacity: 0.8,
  }),
  draggedPlaceholder: css({
    width: '100%',
    height: '100%',
    boxShadow: `0 0 ${theme.spacing(0.5)} ${theme.colors.primary.border}`,
    background: `${theme.colors.primary.transparent}`,
    zIndex: -1,
  }),
});

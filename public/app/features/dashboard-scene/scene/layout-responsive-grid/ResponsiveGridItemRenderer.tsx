import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { ResponsiveGridItem } from './ResponsiveGridItem';

export function ResponsiveGridItemRenderer({ model }: SceneComponentProps<ResponsiveGridItem>) {
  const { body, dragged } = model.useState();
  const grid = model.getParentGrid();
  const { isDragging } = grid.useState();
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container} ref={(ref) => model.setItemRef(ref)}>
      {!!dragged && <div className={styles.draggedPlaceholder} />}

      <div
        className={cx(styles.wrapper, !!dragged && styles.draggedWrapper)}
        style={dragged}
        onMouseEnter={isDragging ? (evt) => grid.onDragOverItem(evt, model) : undefined}
      >
        <body.Component model={body} />
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      width: '100%',
      height: '100%',
    }),
    wrapper: css({
      width: '100%',
      height: '100%',
      position: 'relative',
    }),
    draggedWrapper: css({
      position: 'absolute',
      zIndex: 1,
      pointerEvents: 'none',
    }),
    draggedPlaceholder: css({
      width: '100%',
      height: '100%',
      boxShadow: `0 0 ${theme.spacing(0.5)} ${theme.colors.primary.border}`,
      background: `${theme.colors.primary.transparent}`,
      zIndex: -1,
    }),
  };
}

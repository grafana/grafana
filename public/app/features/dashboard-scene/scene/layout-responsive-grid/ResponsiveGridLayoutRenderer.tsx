import { css, cx } from '@emotion/css';
import { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { LazyLoader, SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { getDashboardSceneFor } from '../../utils/utils';

import { ResponsiveGridLayout, ResponsiveGridLayoutState } from './ResponsiveGridLayout';

export function ResponsiveGridLayoutRenderer({ model }: SceneComponentProps<ResponsiveGridLayout>) {
  const { children, isHidden, isLazy } = model.useState();
  const styles = useStyles2(getStyles, model.state);
  const { layoutOrchestrator } = getDashboardSceneFor(model).state;

  const { activeLayoutItemRef } = layoutOrchestrator.useState();
  const activeLayoutItem = activeLayoutItemRef?.resolve();
  const currentLayoutIsActive = children.some((c) => c === activeLayoutItem);

  useEffect(() => {
    if (model.containerRef.current) {
      const computedStyles = getComputedStyle(model.containerRef.current);
      model.columnCount = computedStyles.gridTemplateColumns.split(' ').length;
      model.rowCount = computedStyles.gridTemplateRows.split(' ').length;

      // when the contents of a scrollable area are changed, most (all?) browsers
      // seem to automatically adjust the scroll position
      // this hack keeps the scroll position fixed
      if (currentLayoutIsActive && model.scrollPos) {
        model.scrollPos.wrapper?.scrollTo(0, model.scrollPos.scrollTop);
      }
    }
  });

  if (isHidden || !layoutOrchestrator) {
    return null;
  }

  return (
    <div className={styles.container} ref={model.containerRef}>
      <div
        style={{
          gridRow: model.activeGridCell.row,
          gridColumn: model.activeGridCell.column,
          display: currentLayoutIsActive && model.activeIndex !== undefined ? 'grid' : 'none',
        }}
      />
      {children.map((item) => {
        const Wrapper = isLazy ? LazyLoader : 'div';
        const isDragging = activeLayoutItem === item;

        return (
          <Wrapper
            key={item.state.key!}
            className={cx(styles.wrapper, { [styles.dragging]: isDragging })}
            style={
              isDragging && layoutOrchestrator && item.cachedBoundingBox
                ? {
                    width: item.cachedBoundingBox.right - item.cachedBoundingBox.left,
                    height: item.cachedBoundingBox.bottom - item.cachedBoundingBox.top,
                    translate: `${-layoutOrchestrator.dragOffset.left}px ${-layoutOrchestrator.dragOffset.top}px`,
                    // --x/y-pos are set in LayoutOrchestrator
                    transform: `translate(var(--x-pos), var(--y-pos))`,
                  }
                : {}
            }
            ref={item.containerRef}
          >
            <item.Component model={item} />
          </Wrapper>
        );
      })}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, state: ResponsiveGridLayoutState) => ({
  container: css({
    display: 'grid',
    position: 'relative',
    gridTemplateColumns: state.templateColumns,
    gridTemplateRows: state.templateRows || 'unset',
    gridAutoRows: state.autoRows || 'unset',
    rowGap: theme.spacing(state.rowGap ?? 1),
    columnGap: theme.spacing(state.columnGap ?? 1),
    justifyItems: state.justifyItems || 'unset',
    alignItems: state.alignItems || 'unset',
    justifyContent: state.justifyContent || 'unset',
    flexGrow: 1,

    [theme.breakpoints.down('md')]: state.md
      ? {
          gridTemplateRows: state.md.templateRows,
          gridTemplateColumns: state.md.templateColumns,
          rowGap: state.md.rowGap ? theme.spacing(state.md.rowGap ?? 1) : undefined,
          columnGap: state.md.columnGap ? theme.spacing(state.md.rowGap ?? 1) : undefined,
          justifyItems: state.md.justifyItems,
          alignItems: state.md.alignItems,
          justifyContent: state.md.justifyContent,
        }
      : undefined,
  }),
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

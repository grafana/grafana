import { css } from '@emotion/css';
import { useRef, ComponentType, type PointerEventHandler, MutableRefObject } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { LayoutOrchestrator } from '../layout-manager/LayoutOrchestrator';
import { closestOfType } from '../layout-manager/utils';

import { ResponsiveGridItemProps } from './ResponsiveGridItemRenderer';
import { ResponsiveGridLayout, ResponsiveGridLayoutState } from './ResponsiveGridLayout';

export interface DragAndDropProps {
  handleProps: {
    onPointerDown: PointerEventHandler<HTMLElement>;
  };

  containerProps: {
    ref: MutableRefObject<HTMLElement>;
  };
}

let i = 0;
export function ResponsiveGridRenderer({ model }: SceneComponentProps<ResponsiveGridLayout>) {
  const { children, isHidden } = model.useState();
  const styles = useStyles2(getStyles, model.state);
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutOrchestrator = closestOfType(model, (s) => s instanceof LayoutOrchestrator);
  const { activeLayoutItemRef } = layoutOrchestrator!.useState();
  const activeLayoutItem = activeLayoutItemRef?.resolve();
  const currentLayoutIsActive = children.some((c) => c === activeLayoutItem);

  console.log(`ResponsiveGridRenderer: ${i++}`);
  if (isHidden || !layoutOrchestrator) {
    return null;
  }

  // console.log(`Current layout is active?: ${currentLayoutIsActive}`);
  // console.log(`Active order: ${activeOrder}`);

  return (
    <div className={styles.container} ref={containerRef}>
      <div
        style={{
          order: model.activeOrder,
          display: currentLayoutIsActive && model.activeOrder ? 'grid' : 'none',
        }}
      ></div>
      {children.map((item, i) => {
        const Component = item.Component as ComponentType<ResponsiveGridItemProps>;
        // const Wrapper = isLazy ? LazyLoader : 'div';

        return (
          <Component key={item.state.key!} model={item} order={i} />
          // <Wrapper
          //   key={item.state.key!}
          //   className={classNames(styles.itemWrapper, { [styles.dragging]: isDragging })}
          //   data-order={isHidden ? -1 : i}
          //   id={item.state.key}
          // >
          //   <Component model={item}  />
          // </Wrapper>
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
});

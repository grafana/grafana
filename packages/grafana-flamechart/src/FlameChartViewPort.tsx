import { css } from '@emotion/css';
import { useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { FlameChartNode } from './FlameChartNode';
import { ParallelGuideline } from './ParallelGuideline';
import { useRenderItems } from './hooks/useRenderItems';
import { FlameChartContainer, RenderItem, ViewRange } from './types';
import { isRelatedTo } from './utils/operation';

interface FlameChartViewPortProps<T> {
  container: FlameChartContainer<T>;
  viewRange: ViewRange;
}

export function FlameChartViewPort<T>(props: FlameChartViewPortProps<T>) {
  const { container, viewRange } = props;

  const styles = useStyles2(getStyles);

  const [sizeRef, { width, height }] = useMeasure<HTMLDivElement>();

  const [focusedItem, setFocusedItem] = useState<RenderItem<T> | null>(null);

  const renderItems = useRenderItems({
    container,
    containerSize: { width, height },
    viewRange,
  });

  const [itemsFiltered, connectorsFiltered] = useMemo(
    () => [renderItems.items.filter((item) => !!item.visible), renderItems.connectors.filter((c) => c.child.visible)],
    [renderItems.items, renderItems.connectors]
  );

  console.log('focusedItem', focusedItem);

  return (
    <div ref={sizeRef} style={{ height: `${renderItems.height}px` }} className={styles.container}>
      {itemsFiltered.map((item) => (
        <FlameChartNode
          key={container.getOperationId(item.operation.entity)}
          container={container}
          renderItem={item}
          deemphasise={!!(focusedItem && !isRelatedTo(item.operation, focusedItem.operation))}
          onMouseEnter={() => setFocusedItem(item)}
          onMouseLeave={() => {
            console.log('leave');
            setFocusedItem(null);
          }}
        />
      ))}
      {connectorsFiltered.map((connector) => {
        const related = focusedItem && isRelatedTo(focusedItem.operation, connector.child.operation);
        return (
          <ParallelGuideline
            connector={connector}
            container={container}
            emphasize={!!(focusedItem && related)}
            deemphasize={!!(focusedItem && !related)}
            key={`${container.getOperationId(connector.parent.operation.entity)}-${container.getOperationId(connector.child.operation.entity)}`}
          />
        );
      })}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      position: 'relative',
      overflow: 'hidden',
      width: '100%',
    }),
  };
}

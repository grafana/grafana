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
  onSelectEntity?: (entity: T) => void;
  selectedEntity?: T;
}

export function FlameChartViewPort<T>(props: FlameChartViewPortProps<T>) {
  const { container, viewRange } = props;

  const styles = useStyles2(getStyles);

  const [sizeRef, { width, height }] = useMeasure<HTMLDivElement>();

  const [hoverItem, setHoverItem] = useState<RenderItem<T> | null>(null);

  const renderItems = useRenderItems({
    container,
    containerSize: { width, height },
    viewRange,
  });

  const [itemsFiltered, connectorsFiltered] = useMemo(
    () => [renderItems.items.filter((item) => !!item.visible), renderItems.connectors.filter((c) => c.child.visible)],
    [renderItems.items, renderItems.connectors]
  );

  return (
    <div ref={sizeRef} style={{ height: `${renderItems.height}px` }} className={styles.container}>
      {itemsFiltered.map((item) => (
        <FlameChartNode
          key={container.getOperationId(item.operation.entity)}
          container={container}
          renderItem={item}
          onSelect={() => props.onSelectEntity?.(item.operation.entity)}
          isSelected={props.selectedEntity === item.operation.entity}
          deemphasise={!!(hoverItem && !isRelatedTo(item.operation, hoverItem.operation))}
          onMouseEnter={() => setHoverItem(item)}
          onMouseLeave={() => {
            console.log('leave');
            setHoverItem(null);
          }}
        />
      ))}
      {connectorsFiltered.map((connector) => {
        const related = hoverItem && isRelatedTo(hoverItem.operation, connector.child.operation);
        return (
          <ParallelGuideline
            connector={connector}
            container={container}
            emphasize={!!(hoverItem && related)}
            deemphasize={!!(hoverItem && !related)}
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

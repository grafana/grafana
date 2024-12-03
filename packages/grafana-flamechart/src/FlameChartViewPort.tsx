import { css } from '@emotion/css';
import { useMeasure } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { FlameChartNode } from './FlameChartNode';
import { useRenderItems } from './hooks/useRenderItems';
import { FlameChartContainer } from './types';

interface FlameChartViewPortProps<T> {
  container: FlameChartContainer<T>;
}

export function FlameChartViewPort<T>(props: FlameChartViewPortProps<T>) {
  const { container } = props;

  const styles = useStyles2(getStyles);

  const [sizeRef, { width, height }] = useMeasure<HTMLDivElement>();

  const renderItems = useRenderItems({
    container,
    containerSize: { width, height },
  });

  return (
    <div ref={sizeRef} style={{ height: `${renderItems.height}px` }} className={styles.container}>
      {renderItems.items.map((item) => (
        <FlameChartNode key={container.getOperationId(item.operation.entity)} container={container} renderItem={item} />
      ))}
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

import { css } from '@emotion/css';
import { memo, ReactElement } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { FlameChartContainer, ParallelConnector } from './types';

interface ParallelGuidelineProps<T> {
  connector: ParallelConnector<T>;
  container: FlameChartContainer<T>;
}

function ParallelGuidelineM<T>({
  connector: { parent: from, child: to },
  container,
}: ParallelGuidelineProps<T>): ReactElement {
  const theme = useTheme2();
  const halfHeight = theme.spacing.gridSize * 2;
  const fullHeight = halfHeight * 2;

  const backgroundColor = container.getNodeBackgroundColor(to.operation.entity, theme);

  const styles = getStyles(theme);

  const verticalStyle: React.CSSProperties = {
    top: from.y + fullHeight,
    left: from.x,
    height: to.y - from.y - halfHeight,
    backgroundColor,
  };

  const horizontalStyle: React.CSSProperties = {
    top: to.y + halfHeight,
    left: from.x,
    width: to.x - from.x,
    backgroundColor,
  };

  return (
    <>
      <div className={styles.vertical} style={verticalStyle}></div>
      <div className={styles.horizontal} style={horizontalStyle}></div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  vertical: css({
    position: 'absolute',
    zIndex: 1,
    width: '1px',
  }),
  horizontal: css({
    position: 'absolute',
    zIndex: 1,
    height: '1px',
  }),
});

export const ParallelGuideline = memo(ParallelGuidelineM) as typeof ParallelGuidelineM;

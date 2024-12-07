import { css, cx } from '@emotion/css';
import { memo, ReactElement } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { getCommonStyles } from './commonStyles';
import { FlameChartContainer, ParallelConnector } from './types';

interface ParallelGuidelineProps<T> {
  connector: ParallelConnector<T>;
  container: FlameChartContainer<T>;
  emphasize?: boolean;
  deemphasize?: boolean;
}

function ParallelGuidelineM<T>({
  connector: { parent: from, child: to },
  container,
  emphasize,
  deemphasize,
}: ParallelGuidelineProps<T>): ReactElement {
  const theme = useTheme2();
  const halfHeight = theme.spacing.gridSize * 2;
  const fullHeight = halfHeight * 2;

  const backgroundColor = container.getNodeBackgroundColor(to.operation.entity, theme);

  const styles = useStyles2(getStyles);
  const commonStyles = useStyles2(getCommonStyles);

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
      {!from.cutOffLeft && (
        <div
          className={cx(
            styles.vertical,
            commonStyles.animated,
            deemphasize && commonStyles.deemphasize,
            emphasize && styles.emphasize
          )}
          style={verticalStyle}
        ></div>
      )}
      <div
        className={cx(
          styles.horizontal,
          commonStyles.animated,
          deemphasize && commonStyles.deemphasize,
          emphasize && styles.emphasize
        )}
        style={horizontalStyle}
      ></div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  vertical: css({
    position: 'absolute',
    zIndex: 1,
    width: '1px',
  }),
  emphasize: css({
    zIndex: 3,
  }),
  horizontal: css({
    position: 'absolute',
    zIndex: 1,
    height: '1px',
  }),
});

export const ParallelGuideline = memo(ParallelGuidelineM) as typeof ParallelGuidelineM;

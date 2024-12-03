import { css } from '@emotion/css';
import React, { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getTextColorForBackground, useStyles2, useTheme2 } from '@grafana/ui';

import { FlameChartContainer, RenderItem } from './types';
import { formatDuration } from './utils/date';

// smaller than this width render operation content
const WIDTH_CONTENT_CUTOFF_PX = 100;

interface NodeProps<T> {
  container: FlameChartContainer<T>;
  renderItem: RenderItem<T>;
}

function FlameChartNodeM<T>({ container, renderItem }: NodeProps<T>): React.ReactElement {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const label = container.getOperationName(renderItem.operation.entity);

  const backgroundColor = container.getNodeBackgroundColor(renderItem.operation.entity, theme);
  const textColor = getTextColorForBackground(backgroundColor);

  const style: React.CSSProperties = {
    top: renderItem.y,
    left: renderItem.x,
    width: renderItem.width,
    backgroundColor,
    color: textColor,
  };

  return (
    <div className={styles.node} style={style}>
      {renderItem.width >= WIDTH_CONTENT_CUTOFF_PX && (
        <>
          <div className={styles.label}>{label}</div>
          <div className={styles.duration}>{formatDuration(renderItem.operation.durationMs * 1000)}</div>
        </>
      )}
    </div>
  );
}

export const FlameChartNode = memo(FlameChartNodeM) as typeof FlameChartNodeM;

const getStyles = (theme: GrafanaTheme2) => ({
  node: css({
    position: 'absolute',
    overflow: 'hidden',
    lineHeight: theme.spacing(4),
    height: theme.spacing(4),
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  }),
  label: css({
    flex: 1,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }),
  duration: css({
    fontStyle: 'italic',
  }),
});

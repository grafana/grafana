import { css, cx } from '@emotion/css';
import React, { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getTextColorForBackground, Icon, useStyles2, useTheme2 } from '@grafana/ui';

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

  const isError = container.isError(renderItem.operation.entity);

  let background = backgroundColor;
  if (renderItem.cutOffLeft && renderItem.cutOffRight) {
    background = `linear-gradient(to right, transparent, ${backgroundColor} 10px, ${backgroundColor} ${renderItem.width - 10}px, transparent)`;
  } else if (renderItem.cutOffLeft) {
    background = `linear-gradient(to right, transparent, ${backgroundColor} 10px)`;
  } else if (renderItem.cutOffRight) {
    background = `linear-gradient(to right, ${backgroundColor} 99%, ${backgroundColor} ${renderItem.width - 10}px, transparent)`;
  }

  const style: React.CSSProperties = {
    top: renderItem.y,
    left: renderItem.x,
    width: renderItem.width,
    background,
    color: textColor,
  };

  console.log('isError', isError);

  return (
    <div className={cx(styles.node, isError && styles.error)} style={style}>
      {isError && renderItem.width >= 32 && <Icon className={styles.errorIcon} name="exclamation-circle" />}
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
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  }),
  label: css({
    paddingLeft: theme.spacing(1),
    flex: 1,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }),
  duration: css({
    fontStyle: 'italic',
    paddingRight: theme.spacing(1),
  }),
  error: css({}),
  errorIcon: css({
    width: theme.spacing(3),
    height: theme.spacing(3),
    marginLeft: theme.spacing(0.5),
    backgroundColor: theme.colors.error.main,
    borderRadius: theme.shape.radius.circle,
    color: 'white',
    alignSelf: 'center',
  }),
});

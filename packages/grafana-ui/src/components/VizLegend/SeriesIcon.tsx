import { css, cx } from '@emotion/css';
import React, { CSSProperties } from 'react';

import { GrafanaTheme2, fieldColorModeRegistry } from '@grafana/data';
import { LineStyle } from '@grafana/schema';

import { useTheme2, useStyles2 } from '../../themes';

export interface Props extends React.HTMLAttributes<HTMLDivElement> {
  color?: string;
  gradient?: string;
  lineStyle?: LineStyle;
}

export const SeriesIcon = React.memo(
  React.forwardRef<HTMLDivElement, Props>(({ color, className, gradient, lineStyle, ...restProps }, ref) => {
    const theme = useTheme2();
    const styles = useStyles2(getStyles);

    let cssColor: string;

    if (gradient) {
      const colors = fieldColorModeRegistry.get(gradient).getColors?.(theme);
      if (colors?.length) {
        cssColor = `linear-gradient(90deg, ${colors.join(', ')})`;
      } else {
        // Not sure what to default to, this will return gray, this should not happen though.
        cssColor = theme.visualization.getColorByName('');
      }
    } else {
      cssColor = color!;
    }

    const lineStyleStyle =
      lineStyle?.fill === 'dot' ? styles.dot : lineStyle?.fill === 'dash' ? styles.dash : styles.solid;

    return (
      <div
        data-testid="series-icon"
        ref={ref}
        className={cx(className, styles.forcedColors, styles.container, lineStyleStyle)}
        style={{
          borderTopColor: cssColor,
        }}
        {...restProps}
      />
    );
  })
);

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginRight: '8px',
    display: 'inline-block',
    width: '14px',
  }),
  dot: css({
    borderTop: 'dotted 3.99px',
  }),
  dash: css({
    borderTop: 'dashed 3px',
  }),
  solid: css({
    borderTop: 'solid 4px',
    borderRadius: theme.shape.radius.pill,
    display: 'inline-block',
  }),
  forcedColors: css({
    '@media (forced-colors: active)': {
      forcedColorAdjust: 'none',
    },
  }),
});

SeriesIcon.displayName = 'SeriesIcon';

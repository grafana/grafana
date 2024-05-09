import { css, cx } from '@emotion/css';
import React from 'react';

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

    if (lineStyle?.fill === 'dot' || lineStyle?.fill === 'dash') {
      return (
        <div data-testid="series-icon" ref={ref} className={cx(className, styles.container)} {...restProps}>
          {lineStyle?.fill === 'dot' &&
            [0, 1, 2].map((i) => (
              <div
                key={i}
                className={cx(styles.forcedColors, styles.dot)}
                style={{
                  background: cssColor,
                  marginRight: i < 2 ? '1px' : undefined,
                }}
              />
            ))}

          {lineStyle?.fill === 'dash' &&
            [0, 1].map((i) => (
              <div
                key={i}
                className={cx(styles.forcedColors, styles.dash)}
                style={{
                  background: cssColor,
                  marginRight: i === 0 ? '2px' : undefined,
                }}
              />
            ))}
        </div>
      );
    }

    return (
      <div
        data-testid="series-icon"
        ref={ref}
        className={cx(className, styles.forcedColors, styles.container, styles.solid)}
        style={{
          background: cssColor,
        }}
        {...restProps}
      />
    );
  })
);

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginRight: '8px',
    display: 'inline-flex',
  }),
  dot: css({
    width: '4px',
    height: '4px',
    borderRadius: theme.shape.radius.circle,
    display: 'inline-block',
  }),
  dash: css({
    width: '6px',
    height: '4px',
    display: 'inline-block',
  }),
  solid: css({
    width: '14px',
    height: '4px',
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

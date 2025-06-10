import { css, cx } from '@emotion/css';
import { CSSProperties } from 'react';
import * as React from 'react';

import { GrafanaTheme2, fieldColorModeRegistry } from '@grafana/data';
import { LineStyle } from '@grafana/schema';

import { useTheme2, useStyles2 } from '../../themes/ThemeContext';

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

    let customStyle: CSSProperties;

    if (lineStyle?.fill === 'dot' && !gradient) {
      // make a circle bg image and repeat it
      customStyle = {
        backgroundImage: `radial-gradient(circle at 2px 2px, ${color} 2px, transparent 0)`,
        backgroundSize: '4px 4px',
        backgroundRepeat: 'space',
      };
    } else if (lineStyle?.fill === 'dash' && !gradient) {
      // make a rectangle bg image and repeat it
      customStyle = {
        backgroundImage: `linear-gradient(to right, ${color} 100%, transparent 0%)`,
        backgroundSize: '6px 4px',
        backgroundRepeat: 'space',
      };
    } else {
      customStyle = {
        background: cssColor,
        borderRadius: theme.shape.radius.pill,
      };
    }

    return (
      <div
        data-testid="series-icon"
        ref={ref}
        className={cx(className, styles.forcedColors, styles.container)}
        style={customStyle}
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
    height: '4px',
  }),
  forcedColors: css({
    '@media (forced-colors: active)': {
      forcedColorAdjust: 'none',
    },
  }),
});

SeriesIcon.displayName = 'SeriesIcon';

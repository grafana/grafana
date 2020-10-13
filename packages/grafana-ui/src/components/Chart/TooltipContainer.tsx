import React, { useState, useLayoutEffect, useRef, HTMLAttributes } from 'react';
import { stylesFactory } from '../../themes/stylesFactory';
import { selectThemeVariant } from '../../themes/selectThemeVariant';
import { css, cx } from 'emotion';
import { useTheme } from '../../themes/ThemeContext';
import useWindowSize from 'react-use/lib/useWindowSize';
import { GrafanaTheme } from '@grafana/data';

interface TooltipContainerProps extends HTMLAttributes<HTMLDivElement> {
  position: { x: number; y: number };
  offset: { x: number; y: number };
  children?: JSX.Element;
}

const getTooltipContainerStyles = stylesFactory((theme: GrafanaTheme) => {
  const bgColor = selectThemeVariant({ light: theme.palette.gray5, dark: theme.palette.dark1 }, theme.type);
  return {
    wrapper: css`
      overflow: hidden;
      background: ${bgColor};
      /* max-width is set up based on .grafana-tooltip class that's used in dashboard */
      max-width: 800px;
      padding: ${theme.spacing.sm};
      border-radius: ${theme.border.radius.sm};
      z-index: ${theme.zIndex.tooltip};
    `,
  };
});

export const TooltipContainer: React.FC<TooltipContainerProps> = ({
  position,
  offset,
  children,
  className,
  ...otherProps
}) => {
  const theme = useTheme();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { width, height } = useWindowSize();
  const [placement, setPlacement] = useState({
    x: position.x + offset.x,
    y: position.y + offset.y,
  });

  // Make sure tooltip does not overflow window
  useLayoutEffect(() => {
    let xO = 0,
      yO = 0;
    if (tooltipRef && tooltipRef.current) {
      const measurement = tooltipRef.current.getBoundingClientRect();
      const xOverflow = width - (position.x + measurement.width);
      const yOverflow = height - (position.y + measurement.height);
      if (xOverflow < 0) {
        xO = measurement.width;
      }

      if (yOverflow < 0) {
        yO = measurement.height;
      }
    }

    setPlacement({
      x: position.x + offset.x - xO,
      y: position.y + offset.y - yO,
    });
  }, [tooltipRef, position]);

  const styles = getTooltipContainerStyles(theme);

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate3d(${placement.x}px, ${placement.y}px, 0)`,
      }}
      {...otherProps}
      className={cx(styles.wrapper, className)}
    >
      {children}
    </div>
  );
};

TooltipContainer.displayName = 'TooltipContainer';

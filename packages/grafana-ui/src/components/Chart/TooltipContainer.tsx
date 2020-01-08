import React, { useState, useLayoutEffect, useRef } from 'react';
import { stylesFactory } from '../../themes/stylesFactory';
import { selectThemeVariant } from '../../themes/selectThemeVariant';
import { css, cx } from 'emotion';
import { useTheme } from '../../themes/ThemeContext';
import useWindowSize from 'react-use/lib/useWindowSize';
import { GrafanaTheme } from '@grafana/data';

interface TooltipContainerProps {
  position: { x: number; y: number };
  offset: { x: number; y: number };
  children?: JSX.Element;
  isContext?: boolean;
}

const getTooltipContainerStyles = stylesFactory((theme: GrafanaTheme) => {
  const bgColor = selectThemeVariant({ light: theme.colors.gray5, dark: theme.colors.dark1 }, theme.type);
  const contextBg = selectThemeVariant({ light: theme.colors.white, dark: theme.colors.black }, theme.type);
  const boxShadowColor = selectThemeVariant({ light: theme.colors.gray3, dark: theme.colors.black }, theme.type);
  return {
    wrapper: css`
      overflow: hidden;
      background: ${bgColor};
      /* max-width is set up based on .grafana-tooltip class that's used in dashboard */
      max-width: 800px;
      padding: ${theme.spacing.sm};
      border-radius: ${theme.border.radius.sm};
    `,
    context: css`
      box-shadow: 0 2px 5px 0 ${boxShadowColor};
      background: ${contextBg};
    `,
  };
});

export const TooltipContainer: React.FC<TooltipContainerProps> = ({ position, offset, children, isContext }) => {
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
        xO = measurement.width + offset.x;
      }

      if (yOverflow < 0) {
        yO = measurement.height + offset.y;
      }
    }

    setPlacement({
      x: position.x - xO,
      y: position.y - yO,
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
      className={cx(styles.wrapper, { [styles.context]: isContext })}
    >
      {children}
    </div>
  );
};

TooltipContainer.displayName = 'TooltipContainer';

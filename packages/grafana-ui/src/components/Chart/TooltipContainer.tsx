import React, { useState, useLayoutEffect, useRef, HTMLAttributes, useMemo } from 'react';
import { stylesFactory } from '../../themes/stylesFactory';
import { css, cx } from 'emotion';
import { useTheme } from '../../themes/ThemeContext';
import useWindowSize from 'react-use/lib/useWindowSize';
import { Dimensions2D, GrafanaTheme } from '@grafana/data';

interface TooltipContainerProps extends HTMLAttributes<HTMLDivElement> {
  position: { x: number; y: number };
  offset: { x: number; y: number };
  children?: JSX.Element;
}

export const TooltipContainer: React.FC<TooltipContainerProps> = ({
  position: { x: positionX, y: positionY },
  offset: { x: offsetX, y: offsetY },
  children,
  className,
  ...otherProps
}) => {
  const theme = useTheme();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipMeasurementRef = useRef<Dimensions2D>({ width: 0, height: 0 });
  const { width, height } = useWindowSize();
  const [placement, setPlacement] = useState({
    x: positionX + offsetX,
    y: positionY + offsetY,
  });

  const resizeObserver = useMemo(
    () =>
      // TS has hard time playing games with @types/resize-observer-browser, hence the ignore
      // @ts-ignore
      new ResizeObserver((entries) => {
        for (let entry of entries) {
          const tW = Math.floor(entry.contentRect.width + 2 * 8); //  adding padding until Safari supports borderBoxSize
          const tH = Math.floor(entry.contentRect.height + 2 * 8);

          if (tooltipMeasurementRef.current.width !== tW || tooltipMeasurementRef.current.height !== tH) {
            tooltipMeasurementRef.current = {
              width: tW,
              height: tH,
            };
          }
        }
      }),
    []
  );

  useLayoutEffect(() => {
    if (tooltipRef.current) {
      resizeObserver.observe(tooltipRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [resizeObserver]);

  // Make sure tooltip does not overflow window
  useLayoutEffect(() => {
    let xO = 0,
      yO = 0;
    if (tooltipRef && tooltipRef.current) {
      const measurement = tooltipMeasurementRef.current;
      const xOverflow = width - (positionX + measurement.width);
      const yOverflow = height - (positionY + measurement.height);
      if (xOverflow < 0) {
        xO = measurement.width;
      }

      if (yOverflow < 0) {
        yO = measurement.height;
      }
    }

    setPlacement({
      x: positionX + offsetX - xO,
      y: positionY + offsetY - yO,
    });
  }, [width, height, positionX, offsetX, positionY, offsetY]);

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

const getTooltipContainerStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      overflow: hidden;
      background: ${theme.colors.bg2};
      /* max-width is set up based on .grafana-tooltip class that's used in dashboard */
      max-width: 800px;
      padding: ${theme.spacing.sm};
      border-radius: ${theme.border.radius.sm};
      z-index: ${theme.zIndex.tooltip};
    `,
  };
});

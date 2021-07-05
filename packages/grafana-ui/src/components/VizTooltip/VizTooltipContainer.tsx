import React, { useState, useLayoutEffect, useRef, HTMLAttributes, useMemo } from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { getTooltipContainerStyles } from '../../themes/mixins';
import useWindowSize from 'react-use/lib/useWindowSize';
import { Dimensions2D, GrafanaTheme2 } from '@grafana/data';

/**
 * @public
 */
export interface VizTooltipContainerProps extends HTMLAttributes<HTMLDivElement> {
  position: { x: number; y: number };
  offset: { x: number; y: number };
  children?: React.ReactNode;
}

/**
 * @public
 */
export const VizTooltipContainer: React.FC<VizTooltipContainerProps> = ({
  position: { x: positionX, y: positionY },
  offset: { x: offsetX, y: offsetY },
  children,
  className,
  ...otherProps
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipMeasurement, setTooltipMeasurement] = useState<Dimensions2D>({ width: 0, height: 0 });
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

          if (tooltipMeasurement.width !== tW || tooltipMeasurement.height !== tH) {
            setTooltipMeasurement({
              width: tW,
              height: tH,
            });
          }
        }
      }),
    [tooltipMeasurement.height, tooltipMeasurement.width]
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
    let x = 0;
    let y = 0;

    if (tooltipRef && tooltipRef.current) {
      const overflowRight = Math.max(positionX + offsetX + tooltipMeasurement.width - width, 0);
      const overflowLeft = Math.abs(Math.min(positionX - offsetX - tooltipMeasurement.width, 0));
      const wouldOverflowRight = overflowRight > 0;
      const wouldOverflowLeft = overflowLeft > 0;

      const overflowBelow = Math.max(positionY + offsetY + tooltipMeasurement.height - height, 0);
      const overflowAbove = Math.abs(Math.min(positionY - offsetY - tooltipMeasurement.height, 0));
      const wouldOverflowBelow = overflowBelow > 0;
      const wouldOverflowAbove = overflowAbove > 0;

      if (wouldOverflowRight && wouldOverflowLeft) {
        x = overflowRight > overflowLeft ? offsetX : width - offsetX - tooltipMeasurement.width;
      } else if (wouldOverflowRight) {
        x = positionX - offsetX - tooltipMeasurement.width;
      } else {
        x = positionX + offsetX;
      }

      if (wouldOverflowBelow && wouldOverflowAbove) {
        y = overflowBelow > overflowAbove ? offsetY : height - offsetY - tooltipMeasurement.height;
      } else if (wouldOverflowBelow) {
        y = positionY - offsetY - tooltipMeasurement.height;
      } else {
        y = positionY + offsetY;
      }
    }

    setPlacement({
      x,
      y,
    });
  }, [width, height, positionX, offsetX, positionY, offsetY, tooltipMeasurement.width, tooltipMeasurement.height]);

  const styles = useStyles2(getStyles);

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate3d(${placement.x}px, ${placement.y}px, 0)`,
        transition: 'all ease-out 0.1s',
      }}
      {...otherProps}
      className={cx(styles.wrapper, className)}
    >
      {children}
    </div>
  );
};

VizTooltipContainer.displayName = 'VizTooltipContainer';

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    ${getTooltipContainerStyles(theme)}
  `,
});

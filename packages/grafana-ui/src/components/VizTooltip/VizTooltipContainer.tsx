import React, { useState, useLayoutEffect, HTMLAttributes, useMemo, useRef } from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { getTooltipContainerStyles } from '../../themes/mixins';
import useWindowSize from 'react-use/lib/useWindowSize';
import { Dimensions2D, GrafanaTheme2 } from '@grafana/data';
import { usePopper } from 'react-popper';
import { calculateTooltipPosition } from './utils';

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
  const [virtualElement, setVirtualElement] = useState({
    getBoundingClientRect() {
      return {
        top: positionY,
        left: positionX,
        bottom: positionY,
        right: positionX,
        width: 0,
        height: 0,
      };
    },
  });
  const { width, height } = useWindowSize();
  const { styles: popperStyles, attributes } = usePopper(virtualElement, tooltipRef.current);

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
  }, [resizeObserver, tooltipRef]);

  // Make sure tooltip does not overflow window
  useLayoutEffect(() => {
    if (tooltipRef.current) {
      const { x, y } = calculateTooltipPosition(
        positionX,
        positionY,
        tooltipMeasurement.width,
        tooltipMeasurement.height,
        offsetX,
        offsetY,
        width,
        height
      );
      setVirtualElement({
        getBoundingClientRect() {
          return {
            top: y,
            left: x,
            bottom: y,
            right: x,
            width: 0,
            height: 0,
          };
        },
      });
    }
  }, [
    width,
    height,
    positionX,
    offsetX,
    positionY,
    offsetY,
    tooltipMeasurement.width,
    tooltipMeasurement.height,
    tooltipRef,
  ]);

  const styles = useStyles2(getStyles);

  return (
    <div
      ref={tooltipRef}
      style={{
        transition: 'all ease-out 0.1s',
        ...popperStyles.popper,
        display: popperStyles.popper?.transform ? 'block' : 'none',
      }}
      {...attributes.popper}
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

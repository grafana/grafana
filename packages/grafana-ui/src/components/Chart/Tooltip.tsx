import React, { useLayoutEffect, useState } from 'react';
import { css } from 'emotion';
import useMeasure from 'react-use/lib/useMeasure';
import useWindowSize from 'react-use/lib/useWindowSize';
import { Portal } from '../Portal/Portal';
// import { GraphTooltipProps } from '../Graph/GraphTooltip';
import { GraphSeriesXY, TimeZone } from '@grafana/data';
import { FlotPosition } from '../Graph/types';
import { stylesFactory, selectThemeVariant, useTheme } from '../../themes';
import { GrafanaTheme } from '../../types';

export type TooltipMode = 'single' | 'multi';
interface TooltipContainerProps {
  position: { x: number; y: number };
  offset: { x: number; y: number };
  children?: JSX.Element;
}

const getTooltipContainerStyles = stylesFactory((theme: GrafanaTheme) => {
  const bgColor = selectThemeVariant({ light: theme.colors.gray5, dark: theme.colors.dark1 }, theme.type);
  return {
    wrapper: css`
      overflow: hidden;
      background: ${bgColor};
      padding: ${theme.spacing.sm};
      border-radius: ${theme.border.radius.sm};
    `,
  };
});

const TooltipContainer: React.FC<TooltipContainerProps> = ({ position, offset, children }) => {
  const theme = useTheme();
  const [tooltipRef, measurement] = useMeasure();
  const { width, height } = useWindowSize();
  const [placement, setPlacement] = useState({
    x: position.x + offset.x,
    y: position.y + offset.y,
  });
  const styles = getTooltipContainerStyles(theme);

  // Make sure tooltip does not overflow window
  useLayoutEffect(() => {
    const xOverflow = width - (position.x + measurement.width);
    const yOverflow = height - (position.y + measurement.height);
    let xO = 0,
      yO = 0;
    if (xOverflow < 0) {
      xO = measurement.width + offset.x;
    }
    if (yOverflow < 0) {
      yO = measurement.height + offset.y;
    }

    setPlacement({
      x: position.x - xO,
      y: position.y - yO,
    });
  }, [measurement, position]);

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate3d(${placement.x}px, ${placement.y}px,0)`,
      }}
      className={styles.wrapper}
    >
      {children}
    </div>
  );
};

export interface TooltipContentProps {
  series: GraphSeriesXY[];
  seriesIndex?: number;
  datapointIndex?: number;
  timeZone: TimeZone;
  pos: FlotPosition;
  mode: TooltipMode;
}

export interface TooltipProps {
  /** Element used as tooltips content */
  content?: React.ReactElement<any>;
  /** Optional component to be used as a tooltip content */
  tooltipComponent?: React.ComponentType<TooltipContentProps>;
  /** x/y position relative to the window */
  position?: { x: number; y: number };
  /** x/y offset relative to tooltip origin element, i.e. graph's datapoint */
  offset?: { x: number; y: number };
}

export const Tooltip: React.FC<TooltipProps> = ({ content, position, offset }) => {
  if (position) {
    return (
      <Portal
        className={css`
          position: absolute;
          top: 0;
          left: 0;
          pointer-events: none;
          width: 100%;
          height: 100%;
        `}
      >
        <TooltipContainer position={position} offset={offset || { x: 0, y: 0 }}>
          {content}
        </TooltipContainer>
      </Portal>
    );
  }
  return null;
};

Tooltip.displayName = 'ChartTooltip';

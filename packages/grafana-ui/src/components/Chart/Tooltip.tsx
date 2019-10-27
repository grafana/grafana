import React, { useLayoutEffect, useState } from 'react';
import { css } from 'emotion';
import useMeasure from 'react-use/lib/useMeasure';
import useWindowSize from 'react-use/lib/useWindowSize';
import { Portal } from '../Portal/Portal';

interface TooltipContainerProps {
  position: { x: number; y: number };
  offset: { x: number; y: number };
  children?: JSX.Element;
}

const TooltipContainer: React.FC<TooltipContainerProps> = ({ position, offset, children }) => {
  const [tooltipRef, measurement] = useMeasure();
  const { width, height } = useWindowSize();
  const [placement, setPlacement] = useState({
    x: position.x + offset.x,
    y: position.y + offset.y,
  });

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
    >
      {children}
    </div>
  );
};

export interface TooltipProps {
  content?: React.ReactElement<any>;
  position?: { x: number; y: number };
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

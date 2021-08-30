import React, { useState } from 'react';
import { css } from '@emotion/css';
import { Threshold, GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import Draggable, { DraggableBounds } from 'react-draggable';

interface ThresholdDragHandleProps {
  step: Threshold;
  y: number;
  dragBounds: DraggableBounds;
  mapPositionToValue: (y: number) => number;
  onChange: (value: number) => void;
  formatValue: (value: number) => string;
}

export const ThresholdDragHandle: React.FC<ThresholdDragHandleProps> = ({
  step,
  y,
  dragBounds,
  mapPositionToValue,
  formatValue,
  onChange,
}) => {
  const theme = useTheme2();
  const styles = getStyles(theme, step);
  const [currentValue, setCurrentValue] = useState(step.value);

  return (
    <Draggable
      axis="y"
      grid={[1, 1]}
      onStop={(_e, d) => onChange(mapPositionToValue(d.lastY))}
      onDrag={(_e, d) => {
        setCurrentValue(mapPositionToValue(d.lastY));
      }}
      position={{ x: 0, y }}
      bounds={dragBounds}
    >
      <div className={styles.handle}>
        <span className={styles.handleText}>{formatValue(currentValue)}</span>
      </div>
    </Draggable>
  );
};

ThresholdDragHandle.displayName = 'ThresholdDragHandle';

const getStyles = (theme: GrafanaTheme2, step: Threshold) => {
  const background = step.color;
  const textColor = theme.colors.getContrastText(theme.visualization.getColorByName(step.color));

  return {
    handle: css`
      position: absolute;
      left: 0;
      width: calc(100% - 9px);
      height: 18px;
      margin-left: 9px;
      margin-top: -9px;
      cursor: grab;
      background: ${background};
      color: ${textColor};
      font-size: ${theme.typography.bodySmall.fontSize};
      &:before {
        content: '';
        position: absolute;
        left: -9px;
        bottom: 0;
        width: 0;
        height: 0;
        border-right: 9px solid ${background};
        border-top: 9px solid transparent;
        border-bottom: 9px solid transparent;
      }
    `,
    handleText: css`
      display: block;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    `,
  };
};

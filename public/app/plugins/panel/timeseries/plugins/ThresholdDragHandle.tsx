import React, { useMemo, useState } from 'react';
import { css } from '@emotion/css';
import { Threshold, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
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
  const styles = useStyles2(getStyles);
  const [currentValue, setCurrentValue] = useState(step.value);

  const textColor = useMemo(() => {
    return theme.colors.getContrastText(theme.visualization.getColorByName(step.color));
  }, [step.color, theme]);

  return (
    <Draggable
      axis="y"
      grid={[1, 1]}
      onStop={(_e, d) => {
        onChange(mapPositionToValue(d.lastY));
        // as of https://github.com/react-grid-layout/react-draggable/issues/390#issuecomment-623237835
        return false;
      }}
      onDrag={(_e, d) => setCurrentValue(mapPositionToValue(d.lastY))}
      position={{ x: 0, y }}
      bounds={dragBounds}
    >
      <div
        className={styles.handle}
        style={{ color: textColor, background: step.color, borderColor: step.color, borderWidth: 0 }}
      >
        <span className={styles.handleText}>{formatValue(currentValue)}</span>
      </div>
    </Draggable>
  );
};

ThresholdDragHandle.displayName = 'ThresholdDragHandle';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    handle: css`
      position: absolute;
      left: 0;
      width: calc(100% - 9px);
      height: 18px;
      margin-left: 9px;
      margin-top: -9px;
      cursor: grab;
      font-size: ${theme.typography.bodySmall.fontSize};
      &:before {
        content: '';
        position: absolute;
        left: -9px;
        bottom: 0;
        width: 0;
        height: 0;
        border-right-style: solid;
        border-right-width: 9px;
        border-right-color: inherit;
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

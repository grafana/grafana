import { css } from '@emotion/css';
import React, { useState, DragEvent, ReactNode } from 'react';

import { GrafanaTheme2, PluginExtensionGlobalDrawerDroppedData } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { useTimeout } from '../../hooks/useTimeout';

interface DraggableProps {
  children: ReactNode;
  data: PluginExtensionGlobalDrawerDroppedData;
  draggable?: boolean;
  onDragStart?: (data: PluginExtensionGlobalDrawerDroppedData) => void;
  onDragEnd?: () => void;
}

export const Draggable = ({ children, data, draggable = true, onDragStart, onDragEnd }: DraggableProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered] = useState(false);
  const styles = useStyles2(getDraggableStyles, { isDragging: isDragging, isHovered });

  const handleDragStart = (_: DragEvent<HTMLDivElement>) => {
    setIsDragging(true);
    onDragStart?.(data);
  };

  const handleDragEnd = (_: DragEvent<HTMLDivElement>) => {
    setIsDragging(false);
    onDragEnd?.();
  };

  useTimeout(() => setIsDragging(false), isDragging ? 1 : null);

  return (
    <div className={styles.wrapper} draggable={draggable} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {children}
    </div>
  );
};

interface GetDraggableStylesProps {
  isDragging: boolean;
  isHovered: boolean;
}

const getDraggableStyles = (theme: GrafanaTheme2, { isDragging }: GetDraggableStylesProps) => ({
  wrapper: css({
    boxShadow: isDragging ? theme.shadows.z3 : 'none',
  }),
});

import { css } from '@emotion/css';
import React, { useState, MouseEvent, ReactNode } from 'react';

import { useStyles2, GrafanaTheme2 } from '@grafana/ui';

import { useTimeout } from '../../hooks/useTimeout';

interface DraggableProps {
  children: ReactNode;
  data: unknown;
  draggable?: boolean;
  onDragStart?: (data: unknown) => void;
  onDragEnd?: () => void;
}

export const Draggable = ({ children, data, draggable = true, onDragStart, onDragEnd }: DraggableProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const styles = useStyles2(getDraggableStyles, { isDragging: isDragging, isHovered });

  const handleDragStart = (e: MouseEvent<HTMLDivElement, MouseEvent>) => {
    setIsDragging(true);
    onDragStart?.(data);
  };

  const handleDragEnd = (e: MouseEvent<HTMLDivElement, MouseEvent>) => {
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

import { useCallback, useState } from 'react';

import { getDragStyles, useStyles2 } from '@grafana/ui';

type UseHorizontalResizeOptions = {
  initialWidth: number;
  minWidth?: number;
  maxWidth?: number;
};

type UseVerticalResizeOptions = {
  initialHeight: number;
  minHeight?: number;
  maxHeight?: number;
};

export function useHorizontalResize({ initialWidth, minWidth = 0, maxWidth = Infinity }: UseHorizontalResizeOptions) {
  const [width, setWidth] = useState<number>(initialWidth);
  const styles = useStyles2(getDragStyles, 'middle');

  const handleRef = useCallback(
    (handle: HTMLElement | null) => {
      let startX = 0;
      let startWidth = 0;

      const onMouseMove = (e: MouseEvent) => {
        const delta = startX - e.clientX; // dragging left increases width of right sidebar
        const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth - delta));
        setWidth(newWidth);
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      const onMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        startX = e.clientX;
        startWidth = width;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      };

      if (handle?.nodeType === Node.ELEMENT_NODE) {
        handle.addEventListener('mousedown', onMouseDown);
      }

      return () => {
        handle?.removeEventListener('mousedown', onMouseDown);
      };
    },
    [maxWidth, minWidth, width]
  );

  return { handleRef, width, setWidth, className: styles.dragHandleVertical };
}

export function useVerticalResize({ initialHeight, minHeight = 0, maxHeight = Infinity }: UseVerticalResizeOptions) {
  const [height, setHeight] = useState<number>(initialHeight);
  const styles = useStyles2(getDragStyles, 'middle');

  const handleRef = useCallback(
    (handle: HTMLElement | null) => {
      let startY = 0;
      let startHeight = 0;

      const onMouseMove = (e: MouseEvent) => {
        const delta = e.clientY - startY; // dragging down increases height
        const newHeight = Math.min(maxHeight, Math.max(minHeight, startHeight + delta));
        setHeight(newHeight);
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      const onMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        startY = e.clientY;
        startHeight = height;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      };

      if (handle?.nodeType === Node.ELEMENT_NODE) {
        handle.addEventListener('mousedown', onMouseDown);
      }

      return () => {
        handle?.removeEventListener('mousedown', onMouseDown);
      };
    },
    [maxHeight, minHeight, height]
  );

  return { handleRef, height, setHeight, className: styles.dragHandleHorizontal };
}

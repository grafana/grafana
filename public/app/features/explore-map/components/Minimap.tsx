import React, { useCallback, useEffect, useRef } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';
import { selectViewport, selectPanels, selectFrames } from '../state/selectors';
import { updateViewport as updateViewportCRDT } from '../state/crdtSlice';
import { useTransformContext } from '../context/TransformContext';

const CANVAS_SIZE = 50000;
const MINIMAP_SIZE = 200;
const MINIMAP_SCALE = MINIMAP_SIZE / CANVAS_SIZE;

interface MinimapProps {
  containerWidth: number;
  containerHeight: number;
}

export const Minimap: React.FC<MinimapProps> = ({ containerWidth, containerHeight }) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);

  const viewport = useSelector((state) => selectViewport(state.exploreMapCRDT));
  const panels = useSelector((state) => selectPanels(state.exploreMapCRDT));
  const frames = useSelector((state) => selectFrames(state.exploreMapCRDT));
  const { transformRef } = useTransformContext();

  // Draw the minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    // Clear canvas
    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // Draw frames
    Object.values(frames).forEach((frame) => {
      const x = frame.position.x * MINIMAP_SCALE;
      const y = frame.position.y * MINIMAP_SCALE;
      const width = frame.position.width * MINIMAP_SCALE;
      const height = frame.position.height * MINIMAP_SCALE;

      ctx.fillStyle = '#6366f120'; // Light indigo with 20% opacity
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1;
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
    });

    // Draw panels
    Object.values(panels).forEach((panel) => {
      const x = panel.position.x * MINIMAP_SCALE;
      const y = panel.position.y * MINIMAP_SCALE;
      const width = panel.position.width * MINIMAP_SCALE;
      const height = panel.position.height * MINIMAP_SCALE;

      ctx.fillStyle = '#3f51b5';
      ctx.strokeStyle = '#5c6bc0';
      ctx.lineWidth = 0.5;
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
    });

    // Calculate viewport rectangle in canvas coordinates
    // The pan values are negative offsets in screen pixels
    // To get canvas coordinates: canvasX = -panX / zoom
    const viewportX = (-viewport.panX / viewport.zoom) * MINIMAP_SCALE;
    const viewportY = (-viewport.panY / viewport.zoom) * MINIMAP_SCALE;
    const viewportWidth = (containerWidth / viewport.zoom) * MINIMAP_SCALE;
    const viewportHeight = (containerHeight / viewport.zoom) * MINIMAP_SCALE;

    // Draw viewport rectangle
    ctx.strokeStyle = '#00b8d4';
    ctx.fillStyle = '#00b8d420';
    ctx.lineWidth = 2;
    ctx.fillRect(viewportX, viewportY, viewportWidth, viewportHeight);
    ctx.strokeRect(viewportX, viewportY, viewportWidth, viewportHeight);
  }, [viewport, panels, frames, containerWidth, containerHeight]);

  // Handle minimap click to pan
  const handleMinimapInteraction = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !transformRef?.current) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;

      // Convert minimap coordinates to canvas coordinates
      const canvasX = clickX / MINIMAP_SCALE;
      const canvasY = clickY / MINIMAP_SCALE;

      // Calculate the target pan to center the clicked point
      const targetPanX = -(canvasX * viewport.zoom - containerWidth / 2);
      const targetPanY = -(canvasY * viewport.zoom - containerHeight / 2);

      // Update viewport through react-zoom-pan-pinch
      transformRef.current.setTransform(targetPanX, targetPanY, viewport.zoom, 200);

      // Update Redux state
      dispatch(
        updateViewportCRDT({
          zoom: viewport.zoom,
          panX: targetPanX,
          panY: targetPanY,
        })
      );
    },
    [dispatch, viewport.zoom, transformRef]
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      isDraggingRef.current = true;
      handleMinimapInteraction(event);
    },
    [handleMinimapInteraction]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (isDraggingRef.current) {
        handleMinimapInteraction(event);
      }
    },
    [handleMinimapInteraction]
  );

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  return (
    <div className={styles.container}>
      <canvas
        ref={canvasRef}
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        className={styles.canvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'fixed', // Changed from absolute to fixed to escape parent overflow
    bottom: theme.spacing(2),
    left: theme.spacing(2),
    zIndex: 10000, // Increased z-index to be above everything
    borderRadius: theme.shape.radius.default,
    border: `2px solid ${theme.colors.primary.border}`, // More visible border
    boxShadow: theme.shadows.z3,
    backgroundColor: 'transparent',
    padding: theme.spacing(1),
    pointerEvents: 'auto',
    backdropFilter: 'blur(8px)', // Add blur effect for better visibility
  }),
  canvas: css({
    display: 'block',
    cursor: 'pointer',
    borderRadius: theme.shape.radius.default,
    '&:active': {
      cursor: 'grabbing',
    },
  }),
});

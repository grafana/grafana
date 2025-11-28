import { css } from '@emotion/css';
import { useCallback, useRef, useState } from 'react';
import { ReactZoomPanPinchRef, TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { useTransformContext } from '../context/TransformContext';
import { useMockCursors } from '../hooks/useMockCursors';
import { selectMultiplePanels, selectPanel, updateViewport } from '../state/exploreMapSlice';

import { ExploreMapPanelContainer } from './ExploreMapPanelContainer';
import { UserCursor } from './UserCursor';

interface SelectionRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function ExploreMapCanvas() {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const canvasRef = useRef<HTMLDivElement>(null);
  const { transformRef: contextTransformRef } = useTransformContext();
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const justCompletedSelectionRef = useRef(false);

  const panels = useSelector((state) => state.exploreMap.panels);
  const viewport = useSelector((state) => state.exploreMap.viewport);
  const cursors = useSelector((state) => state.exploreMap.cursors);

  // Initialize mock cursors
  useMockCursors();

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't deselect if we just finished a selection drag
      if (justCompletedSelectionRef.current) {
        justCompletedSelectionRef.current = false;
        return;
      }

      // Only deselect if clicking directly on canvas (not on panels)
      if (e.target === e.currentTarget) {
        dispatch(selectPanel({ panelId: undefined }));
      }
    },
    [dispatch]
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only start selection if clicking directly on canvas (not on panels)
      if (e.target !== e.currentTarget) {
        return;
      }

      // Don't start selection on middle or right click
      if (e.button !== 0) {
        return;
      }

      const canvasX = e.nativeEvent.offsetX;
      const canvasY = e.nativeEvent.offsetY;

      setSelectionRect({
        startX: canvasX,
        startY: canvasY,
        currentX: canvasX,
        currentY: canvasY,
      });
      setIsSelecting(true);
    },
    []
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isSelecting || !selectionRect) {
        return;
      }

      const canvasX = e.nativeEvent.offsetX;
      const canvasY = e.nativeEvent.offsetY;

      setSelectionRect({
        ...selectionRect,
        currentX: canvasX,
        currentY: canvasY,
      });
    },
    [isSelecting, selectionRect]
  );

  const handleCanvasMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isSelecting || !selectionRect) {
        return;
      }

      console.log('Selection end:', selectionRect);

      // Calculate selection rectangle bounds
      const minX = Math.min(selectionRect.startX, selectionRect.currentX);
      const maxX = Math.max(selectionRect.startX, selectionRect.currentX);
      const minY = Math.min(selectionRect.startY, selectionRect.currentY);
      const maxY = Math.max(selectionRect.startY, selectionRect.currentY);

      console.log('Selection bounds:', { minX, maxX, minY, maxY });

      // Find panels that intersect with selection rectangle
      const selectedPanelIds = Object.values(panels).filter((panel) => {
        const panelLeft = panel.position.x;
        const panelRight = panel.position.x + panel.position.width;
        const panelTop = panel.position.y;
        const panelBottom = panel.position.y + panel.position.height;

        const intersects = !(panelRight < minX || panelLeft > maxX || panelBottom < minY || panelTop > maxY);
        console.log('Panel', panel.id, 'bounds:', { panelLeft, panelRight, panelTop, panelBottom }, 'intersects:', intersects);

        return intersects;
      }).map((panel) => panel.id);

      console.log('Selected panel IDs:', selectedPanelIds);

      // Check if Cmd/Ctrl is held for additive selection
      const isAdditive = e.metaKey || e.ctrlKey;

      if (selectedPanelIds.length > 0) {
        // Select all panels at once
        console.log('Dispatching selectMultiplePanels with:', { panelIds: selectedPanelIds, addToSelection: isAdditive });
        dispatch(selectMultiplePanels({ panelIds: selectedPanelIds, addToSelection: isAdditive }));
        console.log('After dispatch');
        justCompletedSelectionRef.current = true;
      } else if (!isAdditive) {
        // Clear selection if no panels selected and not holding modifier
        dispatch(selectPanel({ panelId: undefined }));
      }

      setSelectionRect(null);
      setIsSelecting(false);
    },
    [isSelecting, selectionRect, panels, dispatch]
  );

  const handleTransformChange = useCallback(
    (ref: ReactZoomPanPinchRef) => {
      dispatch(
        updateViewport({
          zoom: ref.state.scale,
          panX: ref.state.positionX,
          panY: ref.state.positionY,
        })
      );

      // Update grid scale dynamically to maintain visibility at different zoom levels
      if (canvasRef.current) {
        const scale = ref.state.scale;
        // Adjust grid size and dot size based on zoom level to maintain visibility
        let gridSize = 20;
        let dotSize = 1.5;

        if (scale < 0.8) {
          gridSize = 40;
          dotSize = 3;
        }
        if (scale < 0.5) {
          gridSize = 80;
          dotSize = 4;
        }
        if (scale < 0.3) {
          gridSize = 160;
          dotSize = 6;
        }
        if (scale < 0.2) {
          gridSize = 200;
          dotSize = 10;
        }
        if (scale < 0.15) {
          gridSize = 320;
          dotSize = 14;
        }
        if (scale < 0.1) {
          gridSize = 640;
          dotSize = 18;
        }

        canvasRef.current.style.backgroundSize = `${gridSize}px ${gridSize}px`;
        canvasRef.current.style.backgroundImage = `
          radial-gradient(circle, var(--grid-color) ${dotSize}px, transparent ${dotSize}px)
        `;
      }
    },
    [dispatch]
  );

  return (
    <div className={styles.canvasWrapper}>
      <TransformWrapper
        ref={contextTransformRef}
        initialScale={viewport.zoom}
        initialPositionX={viewport.panX}
        initialPositionY={viewport.panY}
        minScale={0.1}
        maxScale={4}
        limitToBounds={false}
        centerOnInit={false}
        panning={{
          disabled: false,
          excluded: ['panel-drag-handle', 'react-rnd'],
          allowLeftClickPan: false,
          allowRightClickPan: false,
          allowMiddleClickPan: true,
        }}
        onTransformed={handleTransformChange}
        doubleClick={{ disabled: true }}
        wheel={{ step: 0.1 }}
      >
        <TransformComponent wrapperClass={styles.transformWrapper} contentClass={styles.transformContent}>
          <div
            ref={canvasRef}
            className={styles.canvas}
            onClick={handleCanvasClick}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                dispatch(selectPanel({ panelId: undefined }));
              }
            }}
            role="button"
            tabIndex={0}
          >
            {Object.values(panels).map((panel) => (
              <ExploreMapPanelContainer key={panel.id} panel={panel} />
            ))}
            {Object.values(cursors).map((cursor) => (
              <UserCursor key={cursor.userId} cursor={cursor} />
            ))}
            {selectionRect && (
              <div
                className={styles.selectionRect}
                style={{
                  left: `${Math.min(selectionRect.startX, selectionRect.currentX)}px`,
                  top: `${Math.min(selectionRect.startY, selectionRect.currentY)}px`,
                  width: `${Math.abs(selectionRect.currentX - selectionRect.startX)}px`,
                  height: `${Math.abs(selectionRect.currentY - selectionRect.startY)}px`,
                }}
              />
            )}
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    canvasWrapper: css({
      position: 'relative',
      flex: 1,
      overflow: 'hidden',
      backgroundColor: theme.colors.background.canvas,
    }),
    transformWrapper: css({
      width: '100%',
      height: '100%',
      cursor: 'grab',
      '&:active': {
        cursor: 'grabbing',
      },
    }),
    transformContent: css({
      width: '100%',
      height: '100%',
    }),
    canvas: css({
      position: 'relative',
      width: '10000px',
      height: '10000px',
      '--grid-color': theme.colors.border.weak,
      backgroundImage: `
        radial-gradient(circle, var(--grid-color) 1.5px, transparent 1.5px)
      `,
      backgroundSize: '20px 20px',
    }),
    selectionRect: css({
      position: 'absolute',
      border: `2px solid ${theme.colors.primary.border}`,
      backgroundColor: theme.colors.primary.transparent,
      pointerEvents: 'none',
      zIndex: 9999,
    }),
  };
};

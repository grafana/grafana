import { css } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ReactZoomPanPinchRef, TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { useTransformContext } from '../context/TransformContext';
import { useCursorSync } from '../hooks/useCursorSync';
import { useCursorViewportTracking } from '../hooks/useCursorViewportTracking';
import { selectPanel as selectPanelCRDT, updateViewport as updateViewportCRDT, selectMultiplePanels as selectMultiplePanelsCRDT } from '../state/crdtSlice';
import { selectPanels, selectFrames, selectViewport, selectCursors, selectSelectedPanelIds, selectMapUid, selectPostItNotes } from '../state/selectors';

import { EdgeCursorIndicator } from './EdgeCursorIndicator';
import { ExploreMapComment } from './ExploreMapComment';
import { ExploreMapFrame } from './ExploreMapFrame';
import { ExploreMapPanelContainer } from './ExploreMapPanelContainer';
import { ExploreMapStickyNote } from './ExploreMapStickyNote';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const { transformRef: contextTransformRef } = useTransformContext();
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const justCompletedSelectionRef = useRef(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const panels = useSelector((state) => selectPanels(state.exploreMapCRDT));
  const frames = useSelector((state) => selectFrames(state.exploreMapCRDT));
  const postItNotes = useSelector((state) => selectPostItNotes(state.exploreMapCRDT));
  const viewport = useSelector((state) => selectViewport(state.exploreMapCRDT));
  const cursors = useSelector((state) => selectCursors(state.exploreMapCRDT));
  const selectedPanelIds = useSelector((state) => selectSelectedPanelIds(state.exploreMapCRDT));
  const mapUid = useSelector((state) => selectMapUid(state.exploreMapCRDT));

  // Initialize cursor sync
  const { updatePosition, updatePositionImmediate } = useCursorSync({
    mapUid: mapUid || '',
    enabled: !!mapUid,
  });

  // Track cursor viewport positions for edge indicators
  const cursorViewportInfo = useCursorViewportTracking({
    cursors,
    viewport,
    transformRef: contextTransformRef,
    containerWidth: containerSize.width,
    containerHeight: containerSize.height,
  });

  // Track container size for viewport calculations
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    // Initial size
    updateSize();

    // Update on resize
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Send selection update immediately when selection changes
  // Use position (0, 0) since we only care about the selection, not cursor position
  useEffect(() => {
    updatePositionImmediate(0, 0, selectedPanelIds);
  }, [selectedPanelIds, updatePositionImmediate]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't deselect if we just finished a selection drag
      if (justCompletedSelectionRef.current) {
        justCompletedSelectionRef.current = false;
        return;
      }

      // Only deselect if clicking directly on canvas (not on panels) and there are panels to deselect
      if (e.target === e.currentTarget && selectedPanelIds.length > 0) {
        dispatch(selectPanelCRDT({ panelId: undefined }));
      }
    },
    [dispatch, selectedPanelIds]
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

      if (!canvasRef.current) {
        return;
      }

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const screenX = e.clientX - canvasRect.left;
      const screenY = e.clientY - canvasRect.top;

      // Convert screen coordinates to actual canvas coordinates
      // Use transform ref state if available, otherwise fall back to viewport state
      const scale = contextTransformRef?.current?.state?.scale ?? viewport.zoom;

      // Since getBoundingClientRect() gives us the rect AFTER transform,
      // we just need to divide by scale to get canvas coordinates
      const canvasX = screenX / scale;
      const canvasY = screenY / scale;

      setSelectionRect({
        startX: canvasX,
        startY: canvasY,
        currentX: canvasX,
        currentY: canvasY,
      });
      setIsSelecting(true);
    },
    [contextTransformRef, viewport]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Get position relative to the canvas element, not the event target
      if (!canvasRef.current) {
        return;
      }

      // Get the bounding rect of the transformed canvas element
      const canvasRect = canvasRef.current.getBoundingClientRect();

      // Calculate position relative to the canvas element's top-left corner (in screen space)
      const screenX = e.clientX - canvasRect.left;
      const screenY = e.clientY - canvasRect.top;

      // The canvas element is inside TransformComponent which applies CSS transform: scale() and translate()
      // The bounding rect already reflects the transform, so screenX/screenY are in the zoomed coordinate space
      // We need to convert back to the original 10000x10000 canvas coordinate space
      const scale = contextTransformRef?.current?.state?.scale ?? viewport.zoom;

      // Since getBoundingClientRect() gives us the rect AFTER transform,
      // we just need to divide by scale to get canvas coordinates
      const canvasX = Math.max(0, Math.min(10000, screenX / scale));
      const canvasY = Math.max(0, Math.min(10000, screenY / scale));

      // Update cursor position for all sessions (using actual canvas coordinates, clamped to bounds)
      // Include currently selected panel IDs for collaborative selection visualization
      updatePosition(canvasX, canvasY, selectedPanelIds);

      // Handle selection rectangle if dragging (using canvas coordinates)
      if (isSelecting && selectionRect) {
        setSelectionRect({
          ...selectionRect,
          currentX: canvasX,
          currentY: canvasY,
        });
      }
    },
    [isSelecting, selectionRect, updatePosition, contextTransformRef, viewport, selectedPanelIds]
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
        dispatch(selectMultiplePanelsCRDT({ panelIds: selectedPanelIds, addToSelection: isAdditive }));
        console.log('After dispatch');
        justCompletedSelectionRef.current = true;
      } else if (!isAdditive) {
        // Clear selection if no panels selected and not holding modifier
        dispatch(selectPanelCRDT({ panelId: undefined }));
      }

      setSelectionRect(null);
      setIsSelecting(false);
    },
    [isSelecting, selectionRect, panels, dispatch]
  );

  const handleTransformChange = useCallback(
    (ref: ReactZoomPanPinchRef) => {
      dispatch(
        updateViewportCRDT({
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
    <div ref={containerRef} className={styles.canvasWrapper} onMouseMove={handleCanvasMouseMove}>
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
            onMouseUp={handleCanvasMouseUp}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                dispatch(selectPanelCRDT({ panelId: undefined }));
              }
            }}
            role="button"
            tabIndex={0}
          >
            {/* Render frames first (lower z-index) */}
            {Object.values(frames).map((frame) => (
              <ExploreMapFrame key={frame.id} frame={frame} />
            ))}
            {/* Render panels on top */}
            {Object.values(panels).map((panel) => {
              return <ExploreMapPanelContainer key={panel.id} panel={panel} />;
            })}
            {cursorViewportInfo
              .filter((info) => info.isVisible)
              .map((info) => (
                <UserCursor key={info.cursor.sessionId} cursor={info.cursor} zoom={viewport.zoom} />
              ))}
            {Object.values(postItNotes).map((postIt) => (
              <ExploreMapStickyNote key={postIt.id} postIt={postIt} zoom={viewport.zoom} />
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
      {/* Render edge indicators for off-screen cursors */}
      {cursorViewportInfo
        .filter((info) => !info.isVisible)
        .map((info) => (
          <EdgeCursorIndicator key={info.cursor.sessionId} cursorInfo={info} />
        ))}
      <ExploreMapComment />
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

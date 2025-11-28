import { css } from '@emotion/css';
import { useCallback, useRef } from 'react';
import { ReactZoomPanPinchRef, TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { useTransformContext } from '../context/TransformContext';
import { useMockCursors } from '../hooks/useMockCursors';
import { selectPanel, updateViewport } from '../state/exploreMapSlice';

import { ExploreMapPanelContainer } from './ExploreMapPanelContainer';
import { UserCursor } from './UserCursor';

export function ExploreMapCanvas() {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const canvasRef = useRef<HTMLDivElement>(null);
  const { transformRef: contextTransformRef } = useTransformContext();

  const panels = useSelector((state) => state.exploreMap.panels);
  const viewport = useSelector((state) => state.exploreMap.viewport);
  const cursors = useSelector((state) => state.exploreMap.cursors);

  // Initialize mock cursors
  useMockCursors();

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      // Only deselect if clicking directly on canvas (not on panels)
      if (e.target === e.currentTarget) {
        dispatch(selectPanel({ panelId: undefined }));
      }
    },
    [dispatch]
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
        // Adjust grid size and line width based on zoom level to maintain visibility
        // Formula: we want the rendered line to be at least 1px on screen
        // So if scale = 0.17, and we want 1px visible, we need lineWidth / scale >= 1
        // Therefore lineWidth >= 1 / scale
        let gridSize = 20;
        let lineWidth = 1;

        if (scale < 0.8) {
          gridSize = 40;
          lineWidth = 2;
        }
        if (scale < 0.5) {
          gridSize = 80;
          lineWidth = 3;
        }
        if (scale < 0.3) {
          gridSize = 160;
          lineWidth = 4;
        }
        if (scale < 0.2) {
          gridSize = 200;
          lineWidth = 6;
        }
        if (scale < 0.15) {
          gridSize = 320;
          lineWidth = 8;
        }
        if (scale < 0.1) {
          gridSize = 640;
          lineWidth = 12;
        }

        canvasRef.current.style.backgroundSize = `${gridSize}px ${gridSize}px`;
        canvasRef.current.style.backgroundImage = `
          linear-gradient(var(--grid-color) ${lineWidth}px, transparent ${lineWidth}px),
          linear-gradient(90deg, var(--grid-color) ${lineWidth}px, transparent ${lineWidth}px)
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
        linear-gradient(var(--grid-color) 1px, transparent 1px),
        linear-gradient(90deg, var(--grid-color) 1px, transparent 1px)
      `,
      backgroundSize: '20px 20px',
      backgroundPosition: '-1px -1px',
    }),
  };
};

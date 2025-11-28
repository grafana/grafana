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
      backgroundImage: `
        linear-gradient(${theme.colors.border.weak} 1px, transparent 1px),
        linear-gradient(90deg, ${theme.colors.border.weak} 1px, transparent 1px)
      `,
      backgroundSize: '20px 20px',
      backgroundPosition: '-1px -1px',
    }),
  };
};

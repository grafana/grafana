import { css, cx } from '@emotion/css';
import React, { useCallback, useRef, useState } from 'react';
import { Rnd, RndDragCallback, RndResizeCallback } from 'react-rnd';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Dropdown, Menu, useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { splitClose } from '../../explore/state/main';
import {
  associatePanelWithFrame,
  bringPanelToFront,
  clearActiveDrag,
  disassociatePanelFromFrame,
  duplicatePanel,
  removePanel,
  selectPanel,
  setActiveDrag,
  updateMultiplePanelPositions,
  updatePanelPosition,
  updatePanelSize,
} from '../state/crdtSlice';
import { selectSelectedPanelIds, selectViewport, selectCursors, selectFrames } from '../state/selectors';
import { ExploreMapPanel } from '../state/types';

import { ExploreMapPanelContent } from './ExploreMapPanelContent';

interface ExploreMapPanelContainerProps {
  panel: ExploreMapPanel;
}

function ExploreMapPanelContainerComponent({ panel }: ExploreMapPanelContainerProps) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const rndRef = useRef<Rnd>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);

  const selectedPanelIds = useSelector((state) => selectSelectedPanelIds(state.exploreMapCRDT));
  const viewport = useSelector((state) => selectViewport(state.exploreMapCRDT));
  const cursors = useSelector((state) => selectCursors(state.exploreMapCRDT));
  const frames = useSelector((state) => selectFrames(state.exploreMapCRDT));
  const isSelected = selectedPanelIds.includes(panel.id);

  // Find all users who have this panel selected (excluding current user)
  const remoteSelectingUsers = Object.values(cursors).filter(
    (cursor) => cursor.selectedPanelIds?.includes(panel.id)
  );

  // Get the active drag info from a parent context (if any panel is being dragged)
  const activeDragInfo = useSelector((state) => state.exploreMapCRDT.local.activeDrag);

  // Get active frame drag info
  const activeFrameDragInfo = useSelector((state) => state.exploreMapCRDT.local.activeFrameDrag);

  // Check if panel intersects with any frame (>50% overlap)
  const checkFrameIntersection = useCallback((
    panelX: number,
    panelY: number,
    panelWidth: number,
    panelHeight: number
  ): string | null => {
    for (const frame of Object.values(frames)) {
      const panelLeft = panelX;
      const panelRight = panelX + panelWidth;
      const panelTop = panelY;
      const panelBottom = panelY + panelHeight;

      const frameLeft = frame.position.x;
      const frameRight = frame.position.x + frame.position.width;
      const frameTop = frame.position.y;
      const frameBottom = frame.position.y + frame.position.height;

      // Calculate intersection area
      const intersectLeft = Math.max(panelLeft, frameLeft);
      const intersectRight = Math.min(panelRight, frameRight);
      const intersectTop = Math.max(panelTop, frameTop);
      const intersectBottom = Math.min(panelBottom, frameBottom);

      if (intersectRight > intersectLeft && intersectBottom > intersectTop) {
        const intersectArea = (intersectRight - intersectLeft) * (intersectBottom - intersectTop);
        const panelArea = panelWidth * panelHeight;

        // If >50% of panel is inside frame, consider it contained
        if (intersectArea / panelArea > 0.5) {
          return frame.id;
        }
      }
    }

    return null;
  }, [frames]);

  // Calculate effective position considering active drag
  let effectiveX = panel.position.x;
  let effectiveY = panel.position.y;

  // If another panel in the selection is being dragged, apply the offset to this panel
  if (activeDragInfo && activeDragInfo.draggedPanelId !== panel.id && isSelected) {
    effectiveX += activeDragInfo.deltaX;
    effectiveY += activeDragInfo.deltaY;
  }

  // If this panel's frame is being dragged, apply the frame drag offset
  if (activeFrameDragInfo && panel.frameId === activeFrameDragInfo.draggedFrameId) {
    effectiveX += activeFrameDragInfo.deltaX;
    effectiveY += activeFrameDragInfo.deltaY;
  }

  const handleDragStart: RndDragCallback = useCallback(
    (_e, data) => {
      setDragStartPos({ x: data.x, y: data.y });
    },
    []
  );

  const handleDrag: RndDragCallback = useCallback(
    (_e, data) => {
      if (!dragStartPos) {
        return;
      }

      // If dragging multiple panels, store the drag offset in local state
      // This will cause other panels to visually move without CRDT operations
      if (isSelected && selectedPanelIds.length > 1) {
        dispatch(setActiveDrag({
          draggedPanelId: panel.id,
          deltaX: data.x - panel.position.x,
          deltaY: data.y - panel.position.y,
        }));
      }
    },
    [dispatch, panel.id, panel.position.x, panel.position.y, dragStartPos, isSelected, selectedPanelIds.length]
  );

  const handleDragStop: RndDragCallback = useCallback(
    (_e, data) => {
      // Clear the active drag state
      dispatch(clearActiveDrag());

      if (dragStartPos) {
        const deltaX = data.x - dragStartPos.x;
        const deltaY = data.y - dragStartPos.y;

        // Only update position if there was actual movement
        const hasMoved = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;

        if (hasMoved) {
          if (isSelected && selectedPanelIds.length > 1) {
            // Multi-panel drag: update all selected panels with the delta
            // This creates CRDT operations that will be broadcast
            dispatch(
              updateMultiplePanelPositions({
                panelId: panel.id,
                deltaX,
                deltaY,
              })
            );
          }

          // Always update the dragged panel's final position
          dispatch(
            updatePanelPosition({
              panelId: panel.id,
              x: data.x,
              y: data.y,
            })
          );

          // Check if panel should be associated with a frame
          const intersectingFrameId = checkFrameIntersection(
            data.x,
            data.y,
            panel.position.width,
            panel.position.height
          );

          // eslint-disable-next-line no-console
          console.log('[Frame Association] Panel drag ended:', {
            panelId: panel.id,
            currentFrameId: panel.frameId,
            intersectingFrameId,
            panelPos: { x: data.x, y: data.y },
            willAssociate: intersectingFrameId && intersectingFrameId !== panel.frameId,
            willDisassociate: !intersectingFrameId && panel.frameId,
          });

          if (intersectingFrameId && intersectingFrameId !== panel.frameId) {
            // Panel moved into a frame
            const frame = frames[intersectingFrameId];
            const offsetX = data.x - frame.position.x;
            const offsetY = data.y - frame.position.y;

            // eslint-disable-next-line no-console
            console.log('[Frame Association] Associating panel with frame:', {
              panelId: panel.id,
              frameId: intersectingFrameId,
              offset: { offsetX, offsetY },
            });

            dispatch(
              associatePanelWithFrame({
                panelId: panel.id,
                frameId: intersectingFrameId,
                offsetX,
                offsetY,
              })
            );
          } else if (!intersectingFrameId && panel.frameId) {
            // Panel moved out of frame
            // eslint-disable-next-line no-console
            console.log('[Frame Association] Disassociating panel from frame:', {
              panelId: panel.id,
              frameId: panel.frameId,
            });

            dispatch(
              disassociatePanelFromFrame({
                panelId: panel.id,
              })
            );
          }
        }
      }
      setDragStartPos(null);
    },
    [
      dispatch,
      panel.id,
      panel.position.width,
      panel.position.height,
      panel.frameId,
      dragStartPos,
      isSelected,
      selectedPanelIds.length,
      checkFrameIntersection,
      frames,
    ]
  );

  const handleResizeStop: RndResizeCallback = useCallback(
    (_e, _direction, ref, _delta, position) => {
      const newWidth = ref.offsetWidth;
      const newHeight = ref.offsetHeight;

      // Update position
      dispatch(
        updatePanelPosition({
          panelId: panel.id,
          x: position.x,
          y: position.y,
        })
      );

      // Update size
      dispatch(
        updatePanelSize({
          panelId: panel.id,
          width: newWidth,
          height: newHeight,
        })
      );

      // Trigger resize event for Explore components
      window.dispatchEvent(new Event('resize'));
    },
    [dispatch, panel.id]
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux) key
      const isMultiSelect = e.metaKey || e.ctrlKey;

      // If this panel is already selected and we're not multi-selecting,
      // don't change selection (allows dragging multiple selected panels)
      if (isSelected && !isMultiSelect) {
        dispatch(bringPanelToFront({ panelId: panel.id }));
        return;
      }

      dispatch(selectPanel({ panelId: panel.id, addToSelection: isMultiSelect }));

      // Only bring to front if not multi-selecting
      if (!isMultiSelect) {
        dispatch(bringPanelToFront({ panelId: panel.id }));
      }
    },
    [dispatch, panel.id, isSelected]
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // Clean up Explore state first
      dispatch(splitClose(panel.exploreId));
      // Then remove panel
      dispatch(removePanel({ panelId: panel.id }));
    },
    [dispatch, panel.id, panel.exploreId]
  );

  const handleDuplicate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(duplicatePanel({ panelId: panel.id }));
    },
    [dispatch, panel.id]
  );

  const handleInfoClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Build tooltip content for panel info
  const getInfoTooltipContent = useCallback(() => {
    if (panel.createdBy) {
      return t('explore-map.panel.info.created-by', 'Created by: {{creator}}', { creator: panel.createdBy });
    }
    return t('explore-map.panel.info.no-creator', 'Creator unknown');
  }, [panel.createdBy]);

  return (
    <Rnd
      ref={rndRef}
      position={{ x: effectiveX, y: effectiveY }}
      size={{ width: panel.position.width, height: panel.position.height }}
      scale={viewport.zoom}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onMouseDown={handleMouseDown}
      bounds="parent"
      dragHandleClassName="panel-drag-handle"
      className={cx(styles.panelContainer, { [styles.selectedPanel]: isSelected })}
      style={{ zIndex: panel.position.zIndex }}
      minWidth={300}
      minHeight={200}
    >
      <div className={styles.panelWrapper}>
        {/* Render remote user selection outlines */}
        {remoteSelectingUsers.map((user, index) => (
          <div
            key={user.sessionId}
            className={styles.remoteSelection}
            style={{
              borderColor: user.color,
              // Offset each outline slightly so multiple selections are visible
              inset: `${-2 - index * 3}px`,
            }}
          />
        ))}
        <div className={styles.panel}>
          <div className={cx(styles.panelHeader, 'panel-drag-handle')}>
            <div className={styles.panelTitle}>
              {t('explore-map.panel.title', 'Explore Panel {{id}}', { id: panel.id.slice(0, 8) })}
            </div>
            <div className={styles.panelHeaderRight}>
              {remoteSelectingUsers.length > 0 && (
                <div className={styles.remoteUsers}>
                  {remoteSelectingUsers.map((user) => (
                    <span key={user.sessionId} className={styles.remoteUserBadge} style={{ backgroundColor: user.color }}>
                      {user.userName}
                    </span>
                  ))}
                </div>
              )}
              <div className={styles.panelActions}>
                <Dropdown
                  overlay={
                    <Menu>
                      <Menu.Item
                        label={t('explore-map.panel.info', 'Panel information')}
                        icon="info-circle"
                        onClick={handleInfoClick}
                        description={getInfoTooltipContent()}
                      />
                      <Menu.Item
                        label={t('explore-map.panel.duplicate', 'Duplicate panel')}
                        icon="copy"
                        onClick={handleDuplicate}
                      />
                      <Menu.Divider />
                      <Menu.Item
                        label={t('explore-map.panel.remove', 'Remove')}
                        icon="times"
                        onClick={handleRemove}
                      />
                    </Menu>
                  }
                  placement="bottom-end"
                >
                  <Button
                    icon="ellipsis-v"
                    variant="secondary"
                    size="sm"
                    fill="text"
                    aria-label={t('explore-map.panel.actions', 'Panel actions')}
                  />
                </Dropdown>
              </div>
            </div>
          </div>
        <div className={styles.panelContent}>
          <ExploreMapPanelContent
            panelId={panel.id}
            exploreId={panel.exploreId}
            width={panel.position.width}
            height={panel.position.height - 36}
            remoteVersion={panel.remoteVersion}
            mode={panel.mode}
            exploreState={panel.exploreState}
          />
        </div>
      </div>
      </div>
    </Rnd>
  );
}

export const ExploreMapPanelContainer = React.memo(ExploreMapPanelContainerComponent, (prevProps, nextProps) => {
  const prev = prevProps.panel;
  const next = nextProps.panel;

  // Only re-render if these specific properties change
  // This prevents re-renders when unrelated panels update
  return (
    prev.id === next.id &&
    prev.position.x === next.position.x &&
    prev.position.y === next.position.y &&
    prev.position.width === next.position.width &&
    prev.position.height === next.position.height &&
    prev.position.zIndex === next.position.zIndex &&
    prev.remoteVersion === next.remoteVersion &&
    prev.exploreId === next.exploreId &&
    prev.mode === next.mode
  );
});

const getStyles = (theme: GrafanaTheme2) => {
  return {
    panelContainer: css({
      cursor: 'default',
    }),
    panelWrapper: css({
      position: 'relative',
      width: '100%',
      height: '100%',
    }),
    remoteSelection: css({
      position: 'absolute',
      pointerEvents: 'none',
      border: '2px solid',
      borderRadius: theme.shape.radius.default,
      zIndex: 1,
    }),
    panel: css({
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      boxShadow: theme.shadows.z2,
      position: 'relative',
      zIndex: 2,
    }),
    selectedPanel: css({
      '& > div > div': {
        border: `2px solid ${theme.colors.primary.border}`,
      },
    }),
    panelHeader: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(1, 1.5),
      backgroundColor: theme.colors.background.secondary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      cursor: 'move',
      minHeight: '36px',
    }),
    panelTitle: css({
      fontSize: theme.typography.body.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      userSelect: 'none',
      flex: 1,
      minWidth: 0, // Allow text truncation
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    panelHeaderRight: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      flexShrink: 0, // Prevent shrinking
    }),
    remoteUsers: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      alignItems: 'center',
    }),
    remoteUserBadge: css({
      fontSize: theme.typography.bodySmall.fontSize,
      padding: theme.spacing(0.25, 0.75),
      borderRadius: theme.shape.radius.default,
      color: 'white',
      fontWeight: theme.typography.fontWeightMedium,
      userSelect: 'none',
      whiteSpace: 'nowrap',
    }),
    panelActions: css({
      display: 'flex',
      gap: theme.spacing(0.5),
    }),
    panelContent: css({
      flex: 1,
      overflow: 'hidden',
      position: 'relative',
    }),
  };
};

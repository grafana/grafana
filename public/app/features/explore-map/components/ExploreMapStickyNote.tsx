import { css, cx } from '@emotion/css';
import React, { useCallback, useRef, useState } from 'react';
import { Rnd, RndDragCallback, RndResizeCallback } from 'react-rnd';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, TextArea, useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import {
  associatePostItWithFrame,
  bringPostItNoteToFront,
  disassociatePostItFromFrame,
  removePostItNote,
  updatePostItNoteColor,
  updatePostItNotePosition,
  updatePostItNoteSize,
  updatePostItNoteText,
} from '../state/crdtSlice';
import { selectFrames } from '../state/selectors';

interface ExploreMapStickyNoteProps {
  postIt: {
    id: string;
    position: { x: number; y: number; width: number; height: number; zIndex: number };
    text: string;
    color: string;
    createdBy?: string;
    frameId?: string;
    frameOffsetX?: number;
    frameOffsetY?: number;
  };
  zoom: number;
}

export const STICKY_NOTE_COLORS = [
  { name: 'yellow', value: '#f1c40f' },
  { name: 'blue', value: '#3498db' },
  { name: 'green', value: '#2ecc71' },
  { name: 'purple', value: '#9b59b6' },
  { name: 'red', value: '#e74c3c' },
];

export function ExploreMapStickyNote({ postIt, zoom }: ExploreMapStickyNoteProps) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const rndRef = useRef<Rnd>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(postIt.text);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);

  const frames = useSelector((state) => selectFrames(state.exploreMapCRDT));
  const activeFrameDragInfo = useSelector((state) => state.exploreMapCRDT.local.activeFrameDrag);

  const colorInfo = STICKY_NOTE_COLORS.find((c) => c.name === postIt.color) || STICKY_NOTE_COLORS.find((c) => c.name === 'blue') || STICKY_NOTE_COLORS[0];

  // Calculate effective position considering frame drag
  let effectiveX = postIt.position.x;
  let effectiveY = postIt.position.y;

  // If this sticky note's frame is being dragged, apply the frame drag offset
  if (activeFrameDragInfo && postIt.frameId === activeFrameDragInfo.draggedFrameId) {
    effectiveX += activeFrameDragInfo.deltaX;
    effectiveY += activeFrameDragInfo.deltaY;
  }

  // Check if sticky note intersects with a frame (>50% overlap)
  const checkFrameIntersection = useCallback(
    (x: number, y: number, width: number, height: number): string | null => {
      const postItArea = width * height;

      for (const frame of Object.values(frames)) {
        const intersectX = Math.max(0, Math.min(x + width, frame.position.x + frame.position.width) - Math.max(x, frame.position.x));
        const intersectY = Math.max(0, Math.min(y + height, frame.position.y + frame.position.height) - Math.max(y, frame.position.y));
        const intersectArea = intersectX * intersectY;

        if (intersectArea > postItArea * 0.5) {
          return frame.id;
        }
      }

      return null;
    },
    [frames]
  );

  const handleDragStart: RndDragCallback = useCallback(
    (_e, data) => {
      setDragStartPos({ x: data.x, y: data.y });
      dispatch(bringPostItNoteToFront({ postItId: postIt.id }));
    },
    [dispatch, postIt.id]
  );

  const handleDragStop: RndDragCallback = useCallback(
    (_e, data) => {
      if (dragStartPos) {
        const deltaX = data.x - dragStartPos.x;
        const deltaY = data.y - dragStartPos.y;

        // Only update position if there was actual movement
        const hasMoved = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;

        if (hasMoved) {
          dispatch(
            updatePostItNotePosition({
              postItId: postIt.id,
              x: data.x,
              y: data.y,
            })
          );

          // Check if sticky note should be associated with a frame
          const intersectingFrameId = checkFrameIntersection(
            data.x,
            data.y,
            postIt.position.width,
            postIt.position.height
          );

          if (intersectingFrameId && intersectingFrameId !== postIt.frameId) {
            // Sticky note moved into a frame
            const frame = frames[intersectingFrameId];
            const offsetX = data.x - frame.position.x;
            const offsetY = data.y - frame.position.y;

            dispatch(
              associatePostItWithFrame({
                postItId: postIt.id,
                frameId: intersectingFrameId,
                offsetX,
                offsetY,
              })
            );
          } else if (!intersectingFrameId && postIt.frameId) {
            // Sticky note moved out of frame
            dispatch(
              disassociatePostItFromFrame({
                postItId: postIt.id,
              })
            );
          }
        }
      }
      setDragStartPos(null);
    },
    [dispatch, postIt.id, postIt.position.width, postIt.position.height, postIt.frameId, dragStartPos, checkFrameIntersection, frames]
  );

  const handleResizeStop: RndResizeCallback = useCallback(
    (_e, _direction, ref, _delta, position) => {
      const newWidth = ref.offsetWidth;
      const newHeight = ref.offsetHeight;

      // Update position
      dispatch(
        updatePostItNotePosition({
          postItId: postIt.id,
          x: position.x,
          y: position.y,
        })
      );

      // Update size
      dispatch(
        updatePostItNoteSize({
          postItId: postIt.id,
          width: newWidth,
          height: newHeight,
        })
      );

      // Check if sticky note should be associated with a frame after resize
      const intersectingFrameId = checkFrameIntersection(
        position.x,
        position.y,
        newWidth,
        newHeight
      );

      if (intersectingFrameId && intersectingFrameId !== postIt.frameId) {
        // Sticky note resized into a frame
        const frame = frames[intersectingFrameId];
        const offsetX = position.x - frame.position.x;
        const offsetY = position.y - frame.position.y;

        dispatch(
          associatePostItWithFrame({
            postItId: postIt.id,
            frameId: intersectingFrameId,
            offsetX,
            offsetY,
          })
        );
      } else if (!intersectingFrameId && postIt.frameId) {
        // Sticky note resized out of frame
        dispatch(
          disassociatePostItFromFrame({
            postItId: postIt.id,
          })
        );
      }
    },
    [dispatch, postIt.id, postIt.frameId, checkFrameIntersection, frames]
  );

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
    setEditText(postIt.text);
    setTimeout(() => {
      textAreaRef.current?.focus();
      textAreaRef.current?.select();
    }, 0);
  }, [postIt.text]);

  const handleSaveText = useCallback(() => {
    dispatch(
      updatePostItNoteText({
        postItId: postIt.id,
        text: editText,
      })
    );
    setIsEditing(false);
  }, [dispatch, postIt.id, editText]);

  const handleCancelEdit = useCallback(() => {
    setEditText(postIt.text);
    setIsEditing(false);
  }, [postIt.text]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancelEdit();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSaveText();
      }
    },
    [handleCancelEdit, handleSaveText]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm(t('explore-map.sticky.delete-confirm', 'Delete this sticky note?'))) {
        dispatch(removePostItNote({ postItId: postIt.id }));
      }
    },
    [dispatch, postIt.id]
  );

  const handleColorChange = useCallback(
    (color: string) => {
      dispatch(
        updatePostItNoteColor({
          postItId: postIt.id,
          color,
        })
      );
    },
    [dispatch, postIt.id]
  );

  // Disable dragging when the frame is being dragged
  const isDraggingDisabled = !!(activeFrameDragInfo && postIt.frameId === activeFrameDragInfo.draggedFrameId);

  return (
    <Rnd
      ref={rndRef}
      position={{ x: effectiveX, y: effectiveY }}
      size={{ width: postIt.position.width, height: postIt.position.height }}
      scale={zoom}
      onDragStart={handleDragStart}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      disableDragging={isDraggingDisabled}
      bounds="parent"
      className={styles.postItContainer}
      style={{ zIndex: postIt.position.zIndex }}
      minWidth={150}
      minHeight={150}
      maxWidth={400}
      maxHeight={400}
    >
      <div
        className={styles.postItContent}
        style={{ backgroundColor: colorInfo.value }}
        onDoubleClick={handleDoubleClick}
      >
        {isEditing ? (
          <div className={styles.editor}>
            <TextArea
              ref={textAreaRef}
              value={editText}
              onChange={(e) => setEditText(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveText}
              className={styles.textArea}
              rows={Math.max(3, Math.floor(postIt.position.height / 30) - 2)}
              autoFocus
            />
            <div className={styles.editorActions}>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancelEdit}
                icon="times"
                className={styles.cancelButton}
              >
                {t('explore-map.sticky.cancel', 'Cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.textContent}>{postIt.text || t('explore-map.sticky.empty', 'Double-click to edit')}</div>
            <div className={styles.actions}>
              <div className={styles.colorPicker}>
                {STICKY_NOTE_COLORS.map((color) => (
                  <button
                    key={color.name}
                    className={cx(styles.colorButton, postIt.color === color.name && styles.colorButtonActive)}
                    style={{ backgroundColor: color.value }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleColorChange(color.name);
                    }}
                    title={color.name}
                    aria-label={t('explore-map.sticky.color', 'Change color to {{color}}', { color: color.name })}
                  />
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                fill="text"
                icon="trash-alt"
                onClick={handleDelete}
                className={styles.deleteButton}
                tooltip={t('explore-map.sticky.delete', 'Delete sticky note')}
              />
            </div>
          </>
        )}
      </div>
    </Rnd>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    postItContainer: css({
      cursor: 'move',
      '&:hover': {
        boxShadow: theme.shadows.z3,
      },
    }),
    postItContent: css({
      width: '100%',
      height: '100%',
      padding: theme.spacing(1.5),
      display: 'flex',
      flexDirection: 'column',
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z2,
      position: 'relative',
      overflow: 'hidden',
      // Add a subtle border for better definition
      border: `1px solid rgba(0, 0, 0, 0.1)`,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'box-shadow 0.2s',
      },
    }),
    textContent: css({
      flex: 1,
      fontSize: theme.typography.body.fontSize,
      // Use darker color for better contrast on bright sticky note backgrounds
      color: theme.colors.text.maxContrast,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      overflow: 'auto',
      minHeight: '60px',
      lineHeight: theme.typography.body.lineHeight,
      fontFamily: theme.typography.fontFamilyMonospace,
      fontWeight: theme.typography.fontWeightMedium,
      // Add text shadow for better readability on bright backgrounds
      textShadow: '0 1px 3px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.3)',
    }),
    editor: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: theme.spacing(1),
    }),
    textArea: css({
      flex: 1,
      resize: 'none',
      fontFamily: theme.typography.fontFamilyMonospace,
      fontWeight: theme.typography.fontWeightMedium,
      // Use a more opaque white background for better contrast
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      border: `2px solid rgba(0, 0, 0, 0.3)`,
      color: theme.colors.text.maxContrast,
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      // Ensure text is clearly visible
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      '&:focus': {
        backgroundColor: theme.colors.background.primary,
        borderColor: theme.colors.primary.border,
        outline: 'none',
        boxShadow: `0 0 0 2px ${theme.colors.primary.transparent}`,
      },
    }),
    editorActions: css({
      display: 'flex',
      justifyContent: 'flex-end',
      gap: theme.spacing(1),
    }),
    actions: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing(1),
      gap: theme.spacing(1),
    }),
    colorPicker: css({
      display: 'flex',
      gap: theme.spacing(0.5),
    }),
    colorButton: css({
      width: '20px',
      height: '20px',
      borderRadius: theme.shape.radius.default,
      border: `2px solid ${theme.colors.border.weak}`,
      cursor: 'pointer',
      padding: 0,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'transform 0.2s, border-color 0.2s',
      },
      '&:hover': {
        transform: 'scale(1.1)',
        borderColor: theme.colors.border.medium,
      },
    }),
    colorButtonActive: css({
      borderColor: theme.colors.text.primary,
      borderWidth: '3px',
    }),
    deleteButton: css({
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(0.5, 1),
      color: '#555555',
      opacity: 1,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'border-color 0.2s, color 0.2s',
      },
      '&:hover': {
        borderColor: theme.colors.border.medium,
        color: '#333333',
      },
    }),
    cancelButton: css({
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'background-color 0.2s',
      },
      '&:hover': {
        backgroundColor: theme.colors.background.canvas,
      },
    }),
  };
};


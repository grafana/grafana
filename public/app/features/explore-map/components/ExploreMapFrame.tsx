import { css, cx } from '@emotion/css';
import React, { useCallback, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Rnd, RndDragCallback, RndResizeCallback } from 'react-rnd';
import { useClickAway } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { useDispatch, useSelector } from 'app/types/store';

import {
  updateFramePosition,
  updateFrameSize,
  updateFrameTitle,
  updateFrameColor,
  updateFrameEmoji,
  setActiveFrameDrag,
  clearActiveFrameDrag,
  associatePanelWithFrame,
  disassociatePanelFromFrame,
  removeFrame,
} from '../state/crdtSlice';
import { selectViewport, selectPanelsInFrame, selectPanels, selectFrames } from '../state/selectors';
import { ExploreMapFrame as Frame } from '../state/types';

import { ConfirmDeleteFrameDialog } from './ConfirmDeleteFrameDialog';

interface ExploreMapFrameProps {
  frame: Frame;
}

// Predefined color palette for frames
const FRAME_COLORS = [
  { name: 'Blue', value: '#6e9fff' },
  { name: 'Green', value: '#73bf69' },
  { name: 'Yellow', value: '#fade2a' },
  { name: 'Orange', value: '#ff9830' },
  { name: 'Red', value: '#f2495c' },
  { name: 'Purple', value: '#b877d9' },
  { name: 'Pink', value: '#fe85b4' },
  { name: 'Cyan', value: '#5dc4cd' },
  { name: 'Gray', value: '#9fa7b3' },
];

// Predefined emoji options for frames
const FRAME_EMOJIS = [
  '📦', '📊', '📈', '🎯', '🔥', '⭐', '💡', '🚀',
  '📝', '🎨', '🔧', '⚙️', '🏆', '🎪', '🌟', '💼',
  '📌', '🔍', '📱', '💻', '🖥️', '⚡', '🌈', '🎭',
];

function ExploreMapFrameComponent({ frame }: ExploreMapFrameProps) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const viewport = useSelector((state) => selectViewport(state.exploreMapCRDT));
  const panelsInFrame = useSelector((state) => selectPanelsInFrame(state.exploreMapCRDT, frame.id));
  const allPanels = useSelector((state) => selectPanels(state.exploreMapCRDT));
  const allFrames = useSelector((state) => selectFrames(state.exploreMapCRDT));
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(frame.title);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const colorButtonRef = useRef<HTMLButtonElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const [colorPickerPosition, setColorPickerPosition] = useState<{ top: number; left: number } | null>(null);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState<{ top: number; left: number } | null>(null);

  // Track current size during resize for visual feedback
  const [currentSize, setCurrentSize] = useState({
    width: frame.position.width,
    height: frame.position.height,
  });

  // Sync currentSize when frame position changes (from remote updates or after resize completes)
  React.useEffect(() => {
    setCurrentSize({
      width: frame.position.width,
      height: frame.position.height,
    });
  }, [frame.position.width, frame.position.height]);

  // Check if two rectangles overlap
  const checkRectOverlap = useCallback(
    (
      x1: number,
      y1: number,
      w1: number,
      h1: number,
      x2: number,
      y2: number,
      w2: number,
      h2: number
    ): boolean => {
      return !(x1 + w1 <= x2 || x2 + w2 <= x1 || y1 + h1 <= y2 || y2 + h2 <= y1);
    },
    []
  );

  // Check if a proposed position would cause overlap with other frames
  const wouldOverlapOtherFrames = useCallback(
    (x: number, y: number, width: number, height: number): boolean => {
      for (const [frameId, otherFrame] of Object.entries(allFrames)) {
        // Skip the current frame
        if (frameId === frame.id) {
          continue;
        }

        if (
          checkRectOverlap(
            x,
            y,
            width,
            height,
            otherFrame.position.x,
            otherFrame.position.y,
            otherFrame.position.width,
            otherFrame.position.height
          )
        ) {
          return true;
        }
      }
      return false;
    },
    [allFrames, frame.id, checkRectOverlap]
  );

  // Constrain position to avoid overlaps with other frames
  const constrainPosition = useCallback(
    (proposedX: number, proposedY: number, width: number, height: number): { x: number; y: number } => {
      // If no overlap, use the proposed position
      if (!wouldOverlapOtherFrames(proposedX, proposedY, width, height)) {
        return { x: proposedX, y: proposedY };
      }

      // Try to find the nearest valid position by checking nearby positions
      // We'll use the last valid position if we can't find one
      return {
        x: frame.position.x,
        y: frame.position.y,
      };
    },
    [frame.position.x, frame.position.y, wouldOverlapOtherFrames]
  );

  // Check if a panel is >50% inside the frame bounds
  const isPanelInFrame = useCallback(
    (
      panelX: number,
      panelY: number,
      panelWidth: number,
      panelHeight: number,
      frameX: number,
      frameY: number,
      frameWidth: number,
      frameHeight: number
    ): boolean => {
      const panelLeft = panelX;
      const panelRight = panelX + panelWidth;
      const panelTop = panelY;
      const panelBottom = panelY + panelHeight;

      const frameLeft = frameX;
      const frameRight = frameX + frameWidth;
      const frameTop = frameY;
      const frameBottom = frameY + frameHeight;

      // Calculate intersection area
      const intersectLeft = Math.max(panelLeft, frameLeft);
      const intersectRight = Math.min(panelRight, frameRight);
      const intersectTop = Math.max(panelTop, frameTop);
      const intersectBottom = Math.min(panelBottom, frameBottom);

      if (intersectRight > intersectLeft && intersectBottom > intersectTop) {
        const intersectArea = (intersectRight - intersectLeft) * (intersectBottom - intersectTop);
        const panelArea = panelWidth * panelHeight;

        // If >50% of panel is inside frame, consider it contained
        return intersectArea / panelArea > 0.5;
      }

      return false;
    },
    []
  );

  // Update panel-frame associations based on current frame bounds
  // This should only handle NEW panels entering the frame, not existing associations
  const updatePanelAssociations = useCallback(
    (frameX: number, frameY: number, frameWidth: number, frameHeight: number, skipExisting = false) => {
      for (const [panelId, panel] of Object.entries(allPanels)) {
        // Skip panels that are already associated with this frame if skipExisting is true
        // This prevents recalculating offsets for panels that moved with the frame
        if (skipExisting && panel.frameId === frame.id) {
          continue;
        }

        const isInside = isPanelInFrame(
          panel.position.x,
          panel.position.y,
          panel.position.width,
          panel.position.height,
          frameX,
          frameY,
          frameWidth,
          frameHeight
        );

        if (isInside && panel.frameId !== frame.id) {
          // Panel moved into this frame
          const offsetX = panel.position.x - frameX;
          const offsetY = panel.position.y - frameY;

          dispatch(
            associatePanelWithFrame({
              panelId,
              frameId: frame.id,
              offsetX,
              offsetY,
            })
          );
        } else if (!isInside && panel.frameId === frame.id) {
          // Panel moved out of this frame
          dispatch(
            disassociatePanelFromFrame({
              panelId,
            })
          );
        }
      }
    },
    [allPanels, frame.id, isPanelInFrame, dispatch]
  );

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

      // Update local state to show frame and child panels moving in real-time
      const deltaX = data.x - dragStartPos.x;
      const deltaY = data.y - dragStartPos.y;

      dispatch(setActiveFrameDrag({
        draggedFrameId: frame.id,
        deltaX,
        deltaY,
      }));
    },
    [dispatch, frame.id, dragStartPos]
  );

  const handleDragStop: RndDragCallback = useCallback(
    (_e, data) => {
      // Clear the active frame drag state
      dispatch(clearActiveFrameDrag());

      // Apply collision detection to constrain the position
      const constrainedPos = constrainPosition(data.x, data.y, frame.position.width, frame.position.height);

      // Update the frame position (this will move existing child panels)
      dispatch(
        updateFramePosition({
          frameId: frame.id,
          x: constrainedPos.x,
          y: constrainedPos.y,
        })
      );

      // Check for capturing NEW panels (don't disassociate existing ones)
      // Skip existing panels to avoid recalculating their offsets after they've moved with the frame
      setTimeout(() => {
        updatePanelAssociations(constrainedPos.x, constrainedPos.y, frame.position.width, frame.position.height, true);
      }, 0);

      setDragStartPos(null);
    },
    [dispatch, frame.id, frame.position.width, frame.position.height, constrainPosition, updatePanelAssociations]
  );

  const handleResize: RndResizeCallback = useCallback(
    (_e, _direction, ref) => {
      // Update current size during resize for visual feedback
      setCurrentSize({
        width: ref.offsetWidth,
        height: ref.offsetHeight,
      });
    },
    []
  );

  const handleResizeStop: RndResizeCallback = useCallback(
    (_e, _direction, ref, _delta, position) => {
      const newWidth = ref.offsetWidth;
      const newHeight = ref.offsetHeight;

      // Check if the new size would cause overlap
      if (wouldOverlapOtherFrames(position.x, position.y, newWidth, newHeight)) {
        // Revert to the original size if overlap detected
        setCurrentSize({
          width: frame.position.width,
          height: frame.position.height,
        });
        return;
      }

      // Update local size state
      setCurrentSize({
        width: newWidth,
        height: newHeight,
      });

      dispatch(
        updateFramePosition({
          frameId: frame.id,
          x: position.x,
          y: position.y,
        })
      );

      dispatch(
        updateFrameSize({
          frameId: frame.id,
          width: newWidth,
          height: newHeight,
        })
      );

      // Check for panel associations AFTER updating frame
      // This ensures we check against the new frame size
      setTimeout(() => {
        updatePanelAssociations(position.x, position.y, newWidth, newHeight);
      }, 0);
    },
    [dispatch, frame.id, frame.position.width, frame.position.height, wouldOverlapOtherFrames, updatePanelAssociations]
  );

  const handleTitleDoubleClick = useCallback(() => {
    setIsEditingTitle(true);
    setTitleValue(frame.title);
  }, [frame.title]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitleValue(e.target.value);
  }, []);

  const handleTitleBlur = useCallback(() => {
    if (titleValue.trim() && titleValue !== frame.title) {
      dispatch(
        updateFrameTitle({
          frameId: frame.id,
          title: titleValue.trim(),
        })
      );
    }
    setIsEditingTitle(false);
  }, [dispatch, frame.id, titleValue, frame.title]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleTitleBlur();
      } else if (e.key === 'Escape') {
        setIsEditingTitle(false);
        setTitleValue(frame.title);
      }
    },
    [handleTitleBlur, frame.title]
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      // If the frame has panels, show the confirmation dialog
      // Otherwise, delete the frame immediately
      if (panelsInFrame.length > 0) {
        setShowDeleteDialog(true);
      } else {
        dispatch(removeFrame({ frameId: frame.id }));
      }
    },
    [panelsInFrame.length, dispatch, frame.id]
  );

  const handleCloseDeleteDialog = useCallback(() => {
    setShowDeleteDialog(false);
  }, []);

  // Close pickers when clicking outside
  useClickAway(colorPickerRef, () => {
    setShowColorPicker(false);
  });

  useClickAway(emojiPickerRef, () => {
    setShowEmojiPicker(false);
  });

  const handleColorButtonClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!showColorPicker && colorButtonRef.current) {
        const rect = colorButtonRef.current.getBoundingClientRect();
        setColorPickerPosition({
          top: rect.bottom + 4,
          left: rect.left,
        });
      }
      setShowColorPicker(!showColorPicker);
      setShowEmojiPicker(false);
    },
    [showColorPicker]
  );

  const handleColorSelect = useCallback(
    (color: string) => {
      dispatch(
        updateFrameColor({
          frameId: frame.id,
          color,
        })
      );
      setShowColorPicker(false);
    },
    [dispatch, frame.id]
  );

  const handleEmojiButtonClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!showEmojiPicker && emojiButtonRef.current) {
        const rect = emojiButtonRef.current.getBoundingClientRect();
        setEmojiPickerPosition({
          top: rect.bottom + 4,
          left: rect.left,
        });
      }
      setShowEmojiPicker(!showEmojiPicker);
      setShowColorPicker(false);
    },
    [showEmojiPicker]
  );

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      dispatch(
        updateFrameEmoji({
          frameId: frame.id,
          emoji,
        })
      );
      setShowEmojiPicker(false);
    },
    [dispatch, frame.id]
  );

  return (
    <Rnd
      position={{ x: frame.position.x, y: frame.position.y }}
      size={{ width: frame.position.width, height: frame.position.height }}
      scale={viewport.zoom}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      onResize={handleResize}
      onResizeStop={handleResizeStop}
      bounds="parent"
      dragHandleClassName="frame-drag-handle"
      className={styles.frameContainer}
      style={{ zIndex: frame.position.zIndex }}
      minWidth={400}
      minHeight={300}
    >
      <div className={styles.frame}>
        {/* Border overlay that scales inversely with zoom to maintain constant visual width */}
        <div
          className={styles.frameBorder}
          style={{
            width: `${currentSize.width * viewport.zoom}px`,
            height: `${currentSize.height * viewport.zoom}px`,
            transform: `scale(${1 / viewport.zoom})`,
            transformOrigin: 'top left',
            borderColor: frame.color || undefined,
          }}
        />
        <div
          className={styles.frameHeader + ' frame-drag-handle'}
          style={{
            top: `${-30 / viewport.zoom}px`,
            transform: `scale(${1 / viewport.zoom})`,
            transformOrigin: 'top left',
            borderColor: frame.color || undefined,
          }}
        >
          {/* Emoji button */}
          <button
            ref={emojiButtonRef}
            className={styles.emojiButton}
            onClick={handleEmojiButtonClick}
            aria-label="Change emoji"
          >
            {frame.emoji || '🔍'}
          </button>

          {/* Title display/input */}
          {isEditingTitle ? (
            <input
              className={styles.frameTitleInput}
              value={titleValue}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className={styles.frameTitle} onDoubleClick={handleTitleDoubleClick}>
              {frame.title}
            </div>
          )}

          {/* Color picker button */}
          <button
            ref={colorButtonRef}
            className={styles.colorButton}
            onClick={handleColorButtonClick}
            style={{ backgroundColor: frame.color || '#6e9fff' }}
            aria-label="Change frame color"
          />

          {/* Delete button */}
          <IconButton
            name="trash-alt"
            size="sm"
            variant="secondary"
            onClick={handleDeleteClick}
            tooltip="Delete frame"
            className={styles.deleteButton}
          />
        </div>
      </div>
      {showDeleteDialog && (
        <ConfirmDeleteFrameDialog
          frameId={frame.id}
          frameTitle={frame.title}
          panelCount={panelsInFrame.length}
          onClose={handleCloseDeleteDialog}
        />
      )}

      {/* Render pickers via portal to escape z-index stacking context */}
      {showEmojiPicker && emojiPickerPosition && ReactDOM.createPortal(
        <div
          ref={emojiPickerRef}
          className={styles.emojiPicker}
          style={{
            position: 'fixed',
            top: `${emojiPickerPosition.top}px`,
            left: `${emojiPickerPosition.left}px`,
          }}
        >
          {FRAME_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              className={cx(styles.emojiOption, frame.emoji === emoji && styles.emojiOptionSelected)}
              onClick={() => handleEmojiSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>,
        document.body
      )}

      {showColorPicker && colorPickerPosition && ReactDOM.createPortal(
        <div
          ref={colorPickerRef}
          className={styles.colorPicker}
          style={{
            position: 'fixed',
            top: `${colorPickerPosition.top}px`,
            left: `${colorPickerPosition.left}px`,
          }}
        >
          {FRAME_COLORS.map((color) => (
            <button
              key={color.value}
              className={cx(styles.colorOption, frame.color === color.value && styles.colorOptionSelected)}
              style={{ backgroundColor: color.value }}
              onClick={() => handleColorSelect(color.value)}
              title={color.name}
            />
          ))}
        </div>,
        document.body
      )}
    </Rnd>
  );
}

export const ExploreMapFrame = React.memo(ExploreMapFrameComponent);

const getStyles = (theme: GrafanaTheme2) => ({
  frameContainer: css({
    cursor: 'default',
    // Container needs pointer events for resize handles to work
    // But we'll make the interior non-interactive
    '& .react-resizable-handle': {
      pointerEvents: 'auto',
      zIndex: 10, // Ensure handles are above everything
    },
  }),
  frame: css({
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: 'transparent',
    pointerEvents: 'none', // Frame interior doesn't intercept clicks - lets them pass through to panels
  }),
  frameBorder: css({
    position: 'absolute',
    top: 0,
    left: 0,
    border: `2px solid ${theme.colors.border.strong}`,
    borderRadius: theme.shape.radius.default,
    pointerEvents: 'none',
  }),
  frameHeader: css({
    position: 'absolute',
    top: '-30px',
    left: '0',
    padding: theme.spacing(0.5, 1),
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.strong}`,
    borderRadius: theme.shape.radius.default,
    cursor: 'move',
    pointerEvents: 'auto', // Header is interactive
    userSelect: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  deleteButton: css({
    cursor: 'pointer',
  }),
  emojiButton: css({
    fontSize: '20px',
    cursor: 'pointer',
    userSelect: 'none',
    padding: theme.spacing(0.25, 0.5),
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.background.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '&:hover': {
      backgroundColor: theme.colors.background.secondary,
    },
  }),
  emojiPicker: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1),
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    zIndex: 10000,
    minWidth: '240px',
  }),
  emojiOption: css({
    fontSize: '20px',
    padding: theme.spacing(0.5),
    border: `1px solid transparent`,
    borderRadius: theme.shape.radius.default,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '&:hover': {
      backgroundColor: theme.colors.background.secondary,
    },
  }),
  emojiOptionSelected: css({
    border: `1px solid ${theme.colors.primary.border}`,
    backgroundColor: theme.colors.action.selected,
  }),
  frameTitle: css({
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    minWidth: '100px',
  }),
  frameTitleInput: css({
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    padding: theme.spacing(0.5),
    border: 'none',
    outline: `2px solid ${theme.colors.primary.border}`,
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.shape.radius.default,
    minWidth: '100px',
  }),
  colorButton: css({
    width: '24px',
    height: '24px',
    padding: 0,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    '&:hover': {
      opacity: 0.8,
    },
  }),
  colorPicker: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1),
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    zIndex: 10000,
  }),
  colorOption: css({
    width: '32px',
    height: '32px',
    padding: 0,
    border: `2px solid transparent`,
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    '&:hover': {
      opacity: 0.8,
    },
  }),
  colorOptionSelected: css({
    border: `2px solid ${theme.colors.text.primary}`,
  }),
});

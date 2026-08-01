import { css, cx } from '@emotion/css';
import { type DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Icon, IconButton, Stack, useStyles2 } from '@grafana/ui';

import { type CellSource } from '../../model/notebookSpec';

export interface CellPeer {
  name: string;
  color: string;
}

interface Props {
  cellKey: string;
  source: CellSource;
  /** Collaborators currently editing this cell — the frame is outlined in their color. */
  peers?: CellPeer[];
  /** Briefly highlighted (e.g. right after being added from a dashboard or Explore). */
  highlighted?: boolean;
  isDragging?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Cell-type specific actions (e.g. rename / open in Explore for panels). */
  extraActions?: ReactNode;
  children: ReactNode;
}

/**
 * Shared chrome for every notebook cell in edit mode: a drag handle, hover toolbar
 * (collapse/duplicate/delete plus cell-specific actions), provenance badge for
 * assistant-authored cells and a presence outline when a collaborator is editing it.
 */
export function CellFrame({
  cellKey,
  source,
  peers,
  highlighted,
  isDragging,
  dragHandleProps,
  onDuplicate,
  onDelete,
  extraActions,
  children,
}: Props) {
  const styles = useStyles2(getStyles);
  const activePeer = peers?.[0];

  return (
    <div
      className={cx(styles.frame, isDragging && styles.dragging, highlighted && styles.highlighted)}
      style={activePeer ? { boxShadow: `0 0 0 2px ${activePeer.color}` } : undefined}
      data-cell-key={cellKey}
      data-testid={`notebook-cell-${cellKey}`}
    >
      {activePeer && (
        <span className={styles.peerChip} style={{ backgroundColor: activePeer.color }}>
          {activePeer.name}
        </span>
      )}

      <div
        className={cx('notebook-cell-drag-handle', styles.dragHandle)}
        {...dragHandleProps}
        aria-label={t('notebooks.cell.drag', 'Drag to reorder block')}
      >
        <Icon name="draggabledots" size="sm" />
      </div>

      <div className={cx('notebook-cell-toolbar', styles.toolbar)}>
        <Stack direction="row" gap={0.5} alignItems="center">
          {source === 'assistant' && (
            <Badge text={t('notebooks.cell.assistant-badge', 'Assistant')} color="purple" icon="ai" />
          )}
          {extraActions}
          <IconButton
            name="copy"
            size="sm"
            onClick={onDuplicate}
            tooltip={t('notebooks.cell.duplicate', 'Duplicate block')}
          />
          <IconButton
            name="trash-alt"
            size="sm"
            onClick={onDelete}
            tooltip={t('notebooks.cell.delete', 'Delete block')}
          />
        </Stack>
      </div>

      {children}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  frame: css({
    position: 'relative',
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0.5, 0.5, 0.5, 3),
    margin: theme.spacing(0, -0.5, 0, -3),

    '&:hover, &:focus-within': {
      outline: `1px solid ${theme.colors.border.weak}`,
    },

    '&:hover .notebook-cell-toolbar, &:focus-within .notebook-cell-toolbar': {
      opacity: 1,
      pointerEvents: 'auto',
    },

    '&:hover .notebook-cell-drag-handle, &:focus-within .notebook-cell-drag-handle': {
      opacity: 1,
    },
  }),
  dragging: css({
    outline: `1px solid ${theme.colors.primary.border}`,
    background: theme.colors.background.secondary,
    boxShadow: theme.shadows.z3,
  }),
  highlighted: css({
    outline: `2px solid ${theme.colors.primary.border}`,
    background: theme.colors.primary.transparent,
  }),
  dragHandle: css({
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: theme.spacing(3),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.text.disabled,
    opacity: 0,
    cursor: 'grab',

    '&:hover': {
      color: theme.colors.text.secondary,
    },

    '&:active': {
      cursor: 'grabbing',
    },
  }),
  toolbar: css({
    position: 'absolute',
    top: theme.spacing(-1.5),
    right: theme.spacing(1),
    zIndex: 2,
    opacity: 0,
    pointerEvents: 'none',
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0.25, 0.5),
    boxShadow: theme.shadows.z1,
  }),
  peerChip: css({
    position: 'absolute',
    top: theme.spacing(-1.5),
    left: theme.spacing(1),
    zIndex: 2,
    color: theme.colors.getContrastText(theme.colors.primary.main),
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.5,
    padding: theme.spacing(0, 0.75),
    borderRadius: theme.shape.radius.pill,
  }),
});

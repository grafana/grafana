import { css } from '@emotion/css';
import { useEffect } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';

import { useCommentsAnchor } from '../../../../comments/CommentsExtension';

interface Props {
  /** The cell's server-assigned id, which the comments anchor to. */
  cellId: string;
  /** Tells the cell whether its comments are open, so it can show which cell they belong to. */
  onActiveChange?: (active: boolean) => void;
}

/**
 * The notebook's entry point to a cell's comments: a pill with the comment count that opens or closes them.
 * The comments UI only supplies what the button needs (see useCommentsAnchor); what it looks like, what it
 * says and when it shows are the notebook's decisions. Renders nothing where comments are not available.
 */
export function NotebookCommentButton({ cellId, onActiveChange }: Props) {
  const styles = useStyles2(getStyles);
  const anchor = useCommentsAnchor(cellId);
  const isOpen = anchor?.isOpen ?? false;

  useEffect(() => {
    onActiveChange?.(isOpen);
    return () => onActiveChange?.(false);
  }, [isOpen, onActiveChange]);

  // Someone who cannot comment has nothing to open on a cell without comments.
  if (!anchor || (!anchor.canWrite && anchor.count === 0)) {
    return null;
  }

  const { count, toggle, setElement } = anchor;
  const label = isOpen
    ? t('notebook.comments.hide', 'Hide comments')
    : count > 0
      ? t('notebook.comments.show', 'Show comments')
      : t('notebook.comments.add', 'Add comment');

  return (
    <Button
      ref={setElement}
      className={styles.toggle}
      variant="secondary"
      // No frame while there is nothing to count: an empty outlined pill on every cell is noise.
      fill={isOpen ? 'solid' : count > 0 ? 'outline' : 'text'}
      size="sm"
      icon="comment-alt"
      aria-expanded={isOpen}
      aria-label={count > 0 ? `${label} (${count})` : label}
      tooltip={label}
      onClick={toggle}
    >
      {count > 0 ? count : null}
    </Button>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  toggle: css({
    borderRadius: theme.shape.radius.pill,
  }),
});

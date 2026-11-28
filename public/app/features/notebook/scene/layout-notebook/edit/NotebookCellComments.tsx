import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type NotebookCellItem } from '../NotebookCellItem';

import { NotebookCommentButton } from './NotebookCommentButton';

interface Props {
  cell: NotebookCellItem;
  onActiveChange?: (active: boolean) => void;
}

/**
 * Where a notebook puts the comment button: the right gutter beside each cell. The button itself is the
 * notebook's own (NotebookCommentButton); the provider and the box come from the shared comments UI.
 * Renders nothing for a cell that has no id yet: comments anchor to it, and a notebook only gets ids once
 * a writer has saved it.
 */
export function NotebookCellComments({ cell, onActiveChange }: Props) {
  const styles = useStyles2(getStyles);
  const { id } = cell.useState();

  if (!id) {
    return null;
  }

  return (
    <div className={styles.gutter}>
      <NotebookCommentButton cellId={id} onActiveChange={onActiveChange} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Beside the cell, level with its top edge, in the right gutter the document column leaves free.
  gutter: css({
    position: 'absolute',
    top: 0,
    left: '100%',
    paddingLeft: theme.spacing(2),
  }),
});

import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { CommentsTrigger } from '../../../../comments/CommentsExtension';
import { type NotebookCellItem } from '../NotebookCellItem';

interface Props {
  cell: NotebookCellItem;
  onActiveChange?: (active: boolean) => void;
}

/**
 * Where a notebook puts the comment button: the right gutter beside each cell. The comments themselves
 * (the provider for the notebook, the box) come from the shared comments UI; the notebook only decides
 * the placement. Renders nothing for a cell that has no id yet: comments anchor to it, and a notebook only
 * gets ids once a writer has saved it.
 */
export function NotebookCellComments({ cell, onActiveChange }: Props) {
  const styles = useStyles2(getStyles);
  const { id } = cell.useState();

  if (!id) {
    return null;
  }

  return (
    <div className={styles.gutter}>
      <CommentsTrigger anchorId={id} onActiveChange={onActiveChange} />
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

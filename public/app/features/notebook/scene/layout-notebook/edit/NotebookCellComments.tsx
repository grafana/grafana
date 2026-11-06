import { css } from '@emotion/css';
import { createElement } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useFlagDashboardNotebookComments } from '@grafana/runtime/internal';
import { useStyles2 } from '@grafana/ui';

import { getNotebookCellComments } from '../../../enterprise-components/NotebookCellCommentsExtension';
import { isNotebookScene } from '../../isNotebookScene';
import { type NotebookCellItem } from '../NotebookCellItem';

interface Props {
  cell: NotebookCellItem;
  onActiveChange?: (active: boolean) => void;
}

/**
 * The mounting point for the comments UI that enterprise registers. Renders nothing in OSS, with the
 * flag off, for a cell that has no id yet (comments anchor to it, and a notebook only gets ids once a
 * writer has saved it), for a notebook that has not been saved, and for the PDF render.
 */
export function NotebookCellComments({ cell, onActiveChange }: Props) {
  const Comments = getNotebookCellComments();
  const styles = useStyles2(getStyles);
  const enabled = useFlagDashboardNotebookComments();
  const { id } = cell.useState();
  const notebookUid = findNotebookUid(cell);

  if (!enabled || !Comments || !id || !notebookUid || isRenderRoute()) {
    return null;
  }

  return <div className={styles.gutter}>{createElement(Comments, { notebookUid, cellId: id, onActiveChange })}</div>;
}

// Not cell.getParentLayout(), which throws for a cell outside a layout: a frame rendered on its own
// should simply have no comments.
function findNotebookUid(cell: NotebookCellItem): string | undefined {
  let parent = cell.parent;
  while (parent) {
    if (isNotebookScene(parent)) {
      return parent.state.uid;
    }
    parent = parent.parent;
  }
  return undefined;
}

// The PDF render route (see notebookRenderUrl). It reads the notebook for a screenshot and takes no part
// in comments, so it should not even ask for them.
function isRenderRoute(): boolean {
  return locationService.getLocation().pathname.endsWith('/render');
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Beside the cell, level with its top edge, in the right gutter the document column leaves free. No
  // z-index of its own: that would make every gutter its own stacking layer, and a later cell's button
  // would then paint over an earlier cell's open comments.
  gutter: css({
    position: 'absolute',
    top: 0,
    left: '100%',
    paddingLeft: theme.spacing(2),
  }),
});

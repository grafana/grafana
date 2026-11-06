import { type ComponentType } from 'react';

export interface NotebookCellCommentsProps {
  /** The notebook's resource name, which a comment records as its `notebookUID`. */
  notebookUid: string;
  /** The cell's server-assigned id, which a comment records as its `cellId`. */
  cellId: string;
  /** Tells the cell whether its comments are open, so it can show which cell they belong to. */
  onActiveChange?: (active: boolean) => void;
}

type NotebookCellCommentsComponent = ComponentType<NotebookCellCommentsProps>;

let internal: NotebookCellCommentsComponent | undefined;

export function registerNotebookCellComments(component: NotebookCellCommentsComponent) {
  internal = component;
}

export function getNotebookCellComments(): NotebookCellCommentsComponent | undefined {
  return internal;
}

import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';

/**
 * Applies a collaborator's document while protecting the cell the local user is
 * actively editing: the remote doc wins everywhere (last-write-wins), except the
 * locally-focused element keeps its local content so concurrent typing in
 * different cells doesn't clobber in-progress input.
 */
export function mergeRemoteSpec(
  remote: NotebookSpec,
  local: NotebookSpec | undefined,
  editingCellKey: string | null | undefined
): NotebookSpec {
  if (!local || !editingCellKey) {
    return remote;
  }

  const localElement = local.elements[editingCellKey];
  // If the collaborator deleted the cell we're editing, accept the deletion.
  if (!localElement || !remote.elements[editingCellKey]) {
    return remote;
  }

  return {
    ...remote,
    elements: { ...remote.elements, [editingCellKey]: localElement },
  };
}

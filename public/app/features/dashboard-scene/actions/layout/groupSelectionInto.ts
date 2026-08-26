import { type SceneObject } from '@grafana/scenes';

import { buildGroupEdit } from '../../scene/layouts-shared/groupLayout';
import { type GroupTarget } from '../../scene/types/DashboardLayoutManager';
import { edit } from '../utils/edit';

interface GroupSelectionIntoActionProps {
  source: SceneObject;
  items: SceneObject[];
  target: GroupTarget;
}

/**
 * Groups a multi-selection of layout children into a new row or tab as a single undo/redo entry.
 * No-ops when the selection cannot be grouped.
 */
export function groupSelectionInto({ source, items, target }: GroupSelectionIntoActionProps) {
  const groupEdit = buildGroupEdit(items, target);

  if (!groupEdit) {
    return;
  }

  edit({ ...groupEdit, source });
}

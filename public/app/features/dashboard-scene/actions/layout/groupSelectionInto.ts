import { type SceneObject } from '@grafana/scenes';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { buildGroupEdit } from '../../scene/layouts-shared/groupLayout';
import { trackPlanningSection } from '../../scene/planningSession';
import { type GroupTarget } from '../../scene/types/DashboardLayoutManager';
import { findDashboardSceneFor } from '../../utils/utils';
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

  // Records the new row/tab with the active planning session, if any, so endPlanningSession can
  // consider removing it on Dismiss (see trackPlanningSection's doc comment). groupLayout.ts
  // itself stays free of utils/utils (see its own module comment), so this happens here instead.
  // After edit() runs perform(), which is what actually attaches addedObject to the scene —
  // resolving a scene before that would find no ancestor chain to walk.
  const { addedObject } = groupEdit;
  if (addedObject instanceof RowItem || addedObject instanceof TabItem) {
    const scene = findDashboardSceneFor(addedObject);
    if (scene) {
      trackPlanningSection(scene, addedObject);
    }
  }
}

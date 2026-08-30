import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { isRowItem, isTabItem } from '../scene/types/LayoutItemTypeGuards';

export function getTopPlacementLabel(sectionOwner: SceneObject): string | undefined {
  if (isRowItem(sectionOwner)) {
    return t('dashboard-scene.section-placement.top-row', 'Top of row');
  }

  if (isTabItem(sectionOwner)) {
    return t('dashboard-scene.section-placement.top-tab', 'Top of tab');
  }

  return undefined;
}

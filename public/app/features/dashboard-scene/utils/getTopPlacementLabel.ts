import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';

export function getTopPlacementLabel(sectionOwner: SceneObject): string | undefined {
  if (sectionOwner instanceof RowItem) {
    return t('dashboard-scene.section-placement.top-row', 'Top of row');
  }

  if (sectionOwner instanceof TabItem) {
    return t('dashboard-scene.section-placement.top-tab', 'Top of tab');
  }

  return undefined;
}

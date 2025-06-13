import { SceneObject } from '@grafana/scenes';

import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';

import { ItemsWithConditionalRendering } from './types';

export function getItemType(object: SceneObject): ItemsWithConditionalRendering {
  if (object instanceof AutoGridItem) {
    return 'panel';
  } else if (object instanceof RowItem) {
    return 'row';
  } else if (object instanceof TabItem) {
    return 'tab';
  }

  return 'element';
}

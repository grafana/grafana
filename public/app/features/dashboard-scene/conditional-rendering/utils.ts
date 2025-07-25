import { lowerCase } from 'lodash';

import { t } from '@grafana/i18n';
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

export const translatedItemType = (item: ItemsWithConditionalRendering) => {
  const translations: { [key in ItemsWithConditionalRendering]: string } = {
    panel: lowerCase(t('dashboard.edit-pane.elements.panel', 'Panel')),
    row: lowerCase(t('dashboard.edit-pane.elements.row', 'Row')),
    tab: lowerCase(t('dashboard.edit-pane.elements.tab', 'Tab')),
    element: lowerCase(t('dashboard.edit-pane.elements.element', 'Element')),
  };

  return translations[item] || item;
};

import { capitalize, lowerCase } from 'lodash';

import { t } from '@grafana/i18n';
import { SceneObject } from '@grafana/scenes';

import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';

export type ObjectsWithConditionalRendering = 'panel' | 'row' | 'tab' | 'element';

const translatedObjectTypes = {
  get panel() {
    return t('dashboard.edit-pane.elements.panel', 'Panel');
  },
  get row() {
    return t('dashboard.edit-pane.elements.row', 'Row');
  },
  get tab() {
    return t('dashboard.edit-pane.elements.tab', 'Tab');
  },
  get element() {
    return t('dashboard.edit-pane.elements.element', 'Element');
  },
} as const;

const translatedObjectTypesLower: Record<ObjectsWithConditionalRendering, string> = {
  get panel() {
    return lowerCase(t('dashboard.edit-pane.elements.panel', 'Panel'));
  },
  get row() {
    return lowerCase(t('dashboard.edit-pane.elements.row', 'Row'));
  },
  get tab() {
    return lowerCase(t('dashboard.edit-pane.elements.tab', 'Tab'));
  },
  get element() {
    return lowerCase(t('dashboard.edit-pane.elements.element', 'Element'));
  },
} as const;

export function getTranslatedObjectType(type: ObjectsWithConditionalRendering): string {
  return translatedObjectTypes[type] ?? capitalize(type);
}

export function getLowerTranslatedObjectType(type: ObjectsWithConditionalRendering): string {
  return translatedObjectTypesLower[type] ?? type;
}

export function extractObjectType(object: SceneObject | undefined): ObjectsWithConditionalRendering {
  if (!object) {
    return 'element';
  } else if (object instanceof AutoGridItem) {
    return 'panel';
  } else if (object instanceof RowItem) {
    return 'row';
  } else if (object instanceof TabItem) {
    return 'tab';
  }

  return 'element';
}

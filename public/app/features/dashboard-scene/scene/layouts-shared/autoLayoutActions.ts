import { type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { type AutoLayoutScope } from '../../utils/interactions';
import { getDashboardSceneFor } from '../../utils/utils';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';

import { layoutRegistry } from './layoutRegistry';

export type LayoutMode = 'auto' | 'custom';

export interface LayoutModePillInfo {
  icon: IconName;
  label: string;
  tooltip: string;
  layout: LayoutMode;
}

/**
 * Describes the mode pill for a grid layout (auto or custom). Returns undefined for grouping
 * layouts (rows/tabs), which don't own panel sizing and so don't get a pill.
 */
export function getLayoutModePill(manager: DashboardLayoutManager): LayoutModePillInfo | undefined {
  if (manager instanceof AutoGridLayoutManager) {
    return {
      icon: manager.descriptor.icon,
      label: manager.descriptor.name,
      tooltip: t('dashboard.layout-mode-pill.auto-tooltip', 'Panel sizes are managed automatically.'),
      layout: 'auto',
    };
  }

  if (manager instanceof DefaultGridLayoutManager) {
    return {
      icon: manager.descriptor.icon,
      label: manager.descriptor.name,
      tooltip: t('dashboard.layout-mode-pill.custom-tooltip', 'Drag panels to move them and drag their edges to resize.'),
      layout: 'custom',
    };
  }

  return undefined;
}

/**
 * The container that "owns" a grid layout — i.e. the element whose edit pane exposes the layout
 * settings. For a top-level grid this is the dashboard itself, otherwise the parent row/tab.
 */
export function getLayoutContainer(manager: DashboardLayoutManager): SceneObject {
  const parent = manager.parent;

  if (parent instanceof RowItem || parent instanceof TabItem) {
    return parent;
  }

  return getDashboardSceneFor(manager);
}

/**
 * Whether the dashboard is split into rows or tabs. The dashboard-scope layout pill is only useful
 * when there are such containers to disambiguate; a flat single-grid dashboard doesn't need it.
 */
export function dashboardHasRowsOrTabs(scene: SceneObject): boolean {
  const body = getDashboardSceneFor(scene).state.body;
  return body instanceof RowsLayoutManager || body instanceof TabsLayoutManager;
}

export function getLayoutScope(container: SceneObject): AutoLayoutScope {
  if (container instanceof RowItem) {
    return 'row';
  }

  if (container instanceof TabItem) {
    return 'tab';
  }

  return 'dashboard';
}

/**
 * Selects the given container and opens its edit pane. The layout category is open by default,
 * so this surfaces the layout settings (and the layout switcher).
 */
export function selectAndEditLayout(container: SceneObject): void {
  getDashboardSceneFor(container).state.editPane.selectObject(container, { force: true });
}

/**
 * Converts an auto grid to the custom (draggable/resizable) grid layout, preserving the panels.
 * The caller is responsible for showing the "this resets panel positions and sizes" confirmation.
 */
export function switchAutoGridToCustom(manager: AutoGridLayoutManager): void {
  const layoutParent = manager.parent;

  if (layoutParent && isLayoutParent(layoutParent)) {
    const customLayout = layoutRegistry.get(DefaultGridLayoutManager.descriptor.id);
    layoutParent.switchLayout(customLayout.createFromLayout(manager));
  }
}

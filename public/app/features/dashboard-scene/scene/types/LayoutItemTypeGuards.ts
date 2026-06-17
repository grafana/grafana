import { type SceneObject } from '@grafana/scenes';

export interface RowItemLike extends SceneObject {
  readonly dashboardLayoutItemType: 'row';
}

export interface TabItemLike extends SceneObject {
  readonly dashboardLayoutItemType: 'tab';
}

export function isRowItem(object: SceneObject): object is RowItemLike {
  return 'dashboardLayoutItemType' in object && object.dashboardLayoutItemType === 'row';
}

export function isTabItem(object: SceneObject): object is TabItemLike {
  return 'dashboardLayoutItemType' in object && object.dashboardLayoutItemType === 'tab';
}

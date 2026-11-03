import { type RefObject } from 'react';

import { type SceneObject } from '@grafana/scenes';

export interface RowItemLike extends SceneObject {
  readonly dashboardLayoutItemType: 'row';
  readonly containerRef: RefObject<HTMLElement | null>;

  getSlug(): string;
  scrollIntoView(): void;
  getCollapsedState(): boolean;
  setCollapsedState(collapsed: boolean): void;
}

export interface TabItemLike extends SceneObject {
  readonly dashboardLayoutItemType: 'tab';

  getSlug(): string;
}

export function isRowItem(object: SceneObject): object is RowItemLike {
  return 'dashboardLayoutItemType' in object && object.dashboardLayoutItemType === 'row';
}

export function isTabItem(object: SceneObject): object is TabItemLike {
  return 'dashboardLayoutItemType' in object && object.dashboardLayoutItemType === 'tab';
}

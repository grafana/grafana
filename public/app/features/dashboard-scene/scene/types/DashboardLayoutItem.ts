import { RefObject } from 'react';

import { SceneObject, VizPanel } from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { Point, Rect } from '../layout-manager/utils';

export interface IntermediateLayoutItem {
  body: VizPanel;
  origin: Point;
  width: number;
  height: number;
}

/**
 * Abstraction to handle editing of different layout elements (wrappers for VizPanels and other objects)
 * Also useful to when rendering / viewing an element outside it's layout scope
 */
export interface DashboardLayoutItem extends SceneObject {
  /**
   * Marks this object as a layout item
   */
  isDashboardLayoutItem: true;

  /**
   * Reference to the container DOM element.
   */
  containerRef: RefObject<HTMLElement>;

  /**
   * Return layout item options (like repeat, repeat direction, etc. for the default DashboardGridItem)
   */
  getOptions?(): OptionsPaneCategoryDescriptor[];

  /**
   * When going into panel edit
   **/
  editingStarted?(): void;

  /**
   * When coming out of panel edit
   */
  editingCompleted?(withChanges: boolean): void;

  /**
   * Converts the current layout item into an intermediate format.
   */
  toIntermediate(): IntermediateLayoutItem;

  /**
   * Calculates the distance from the current object to a specified point.
   */
  distanceToPoint?(point: Point): number;

  /**
   * Retrieves the bounding box of an element or object.
   */
  boundingBox?(): Rect | undefined;
}

export function isDashboardLayoutItem(obj: SceneObject): obj is DashboardLayoutItem {
  return 'isDashboardLayoutItem' in obj;
}

/**
 * Layout helpers and DOM hooks shared by the Composer session, its overlay and its documents. Free of scene
 * imports, so a document's renderer can mount the overlay without loading the dashboard document.
 */

/** A rectangle in CSS pixels; relative to the overlay unless said otherwise. */
export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** The DOM roots a dashboard capture is narrowed to. */
export const PANEL_ROOT_SELECTOR = '[data-viz-panel-key]';

/** The DOM root of a variable's control in the dashboard controls. */
export const VARIABLE_CONTROL_SELECTOR = '[data-dashboard-element-type="variable"]';

/** The DOM root of an annotation's or another data layer's control in the dashboard controls. */
export const DATA_LAYER_CONTROL_SELECTOR =
  '[data-dashboard-element-type="annotation"], [data-dashboard-element-type="data-layer"]';

/** Every dashboard control Select picks by a click on its label: variables, annotations and data layers. */
export const PICKABLE_CONTROL_SELECTOR = `${VARIABLE_CONTROL_SELECTOR}, ${DATA_LAYER_CONTROL_SELECTOR}`;

/**
 * The smallest element under `container` that holds the whole `rect` (viewport coordinates): the nearest
 * common ancestor of the `selector` roots it overlaps, widened until it covers the rect, else the container.
 */
export function findCaptureRoot(rect: Box, container: HTMLElement, selector = PANEL_ROOT_SELECTOR): HTMLElement {
  const overlapping = [...container.querySelectorAll<HTMLElement>(selector)].filter((element) =>
    overlaps(element.getBoundingClientRect(), rect)
  );
  const holdsAll = (candidate: HTMLElement) => overlapping.every((element) => candidate.contains(element));
  let root: HTMLElement | null = overlapping[0] ?? null;
  while (root && root !== container && !holdsAll(root)) {
    root = root.parentElement;
  }
  while (root && root !== container && !covers(root.getBoundingClientRect(), rect)) {
    root = root.parentElement;
  }
  return root && container.contains(root) ? root : container;
}

/** Whether `bounds` and `rect` (both viewport coordinates) overlap with a positive area. */
export function overlaps(bounds: DOMRect, rect: Box): boolean {
  return (
    Math.min(rect.left + rect.width, bounds.right) > Math.max(rect.left, bounds.left) &&
    Math.min(rect.top + rect.height, bounds.bottom) > Math.max(rect.top, bounds.top)
  );
}

/** Half a pixel of slack for sub-pixel layout. */
function covers(bounds: DOMRect, rect: Box): boolean {
  return (
    bounds.left <= rect.left + 0.5 &&
    bounds.top <= rect.top + 0.5 &&
    bounds.right >= rect.left + rect.width - 0.5 &&
    bounds.bottom >= rect.top + rect.height - 0.5
  );
}

export function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

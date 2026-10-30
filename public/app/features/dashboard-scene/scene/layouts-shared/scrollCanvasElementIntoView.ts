import { colorManipulator } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneGridRow, type SceneObject } from '@grafana/scenes';

import { RowItem } from '../layout-rows/RowItem';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';

export interface CanvasScrollOptions {
  highlight?: boolean;
  panelKey?: string;
}

/**
 * Will scroll element into view. If element is not connected yet, it will try to expand rows
 * and switch tabs to make it visible.
 */
export function scrollCanvasElementIntoView(
  sceneObject: SceneObject,
  ref: React.RefObject<HTMLElement | null>,
  options?: CanvasScrollOptions
) {
  if (ref.current?.isConnected) {
    scrollIntoView(ref.current, options);
    return;
  }

  // try expanding rows and switching tabs
  let parent = sceneObject.parent;
  while (parent) {
    if (parent instanceof RowItem && parent.state.collapse) {
      parent.onCollapseToggle();
    }

    if (parent instanceof SceneGridRow && parent.state.isCollapsed) {
      parent.onCollapseToggle();
    }

    if (parent instanceof TabItem) {
      const tabsManager = parent.parent;
      if (tabsManager instanceof TabsLayoutManager && tabsManager.getCurrentTab() !== parent) {
        tabsManager.switchToTab(parent);
      }
    }
    parent = parent.parent;
  }

  // now try to scroll into view
  setTimeout(() => {
    if (ref.current?.isConnected) {
      scrollIntoView(ref.current, options);
    }
  }, 10);
}

let activeHighlight: Animation | undefined;

export function scrollIntoView(element: HTMLElement, options?: CanvasScrollOptions) {
  // Custom-grid repeats share the layout container. Auto-grid repeats are siblings of the
  // source wrapper that owns containerRef, so look beside it when the key is not inside.
  const panel = options?.panelKey ? findRepeatedPanelElement(element, options.panelKey) : undefined;
  // Draw inside PanelChrome so its background cannot cover the inset outline.
  const target = panel?.querySelector<HTMLElement>('section') ?? panel ?? element;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center', inline: 'center' });

  if (options?.highlight) {
    activeHighlight?.cancel();
    const outlineColor = config.theme2.colors.primary.main;
    const glowColor = config.theme2.colors.text.secondary;
    const outline = `1px solid ${outlineColor}`;
    const dim = {
      outline: `1px solid ${colorManipulator.alpha(outlineColor, 0.2)}`,
      outlineOffset: '-1px',
      boxShadow: 'inset 0 0 0px transparent',
      easing: 'ease-in-out',
    };
    const glow = {
      ...dim,
      outline,
      boxShadow: `inset 0 0 6px ${colorManipulator.alpha(glowColor, 0.15)}`,
    };
    activeHighlight = target.animate(
      reducedMotion
        ? [
            { outline, outlineOffset: '-1px' },
            { outline, outlineOffset: '-1px' },
          ]
        : [dim, glow, dim, glow, { ...dim, outline: '1px solid transparent' }],
      { duration: reducedMotion ? 2000 : 2400 }
    );
    const animation = activeHighlight;
    animation.onfinish = animation.oncancel = () => {
      if (activeHighlight === animation) {
        activeHighlight = undefined;
      }
    };
  }
}

function findRepeatedPanelElement(element: HTMLElement, panelKey: string): HTMLElement | undefined {
  const matchIn = (root: ParentNode) =>
    Array.from(root.querySelectorAll<HTMLElement>('[data-viz-panel-key]')).find(
      (candidate) => candidate.dataset.vizPanelKey === panelKey
    );

  const nested = matchIn(element);
  if (nested) {
    return nested;
  }

  const parent = element.parentElement;
  if (!parent) {
    return undefined;
  }

  for (const child of Array.from(parent.children)) {
    if (child === element || !(child instanceof HTMLElement)) {
      continue;
    }

    const sibling = matchIn(child);
    if (sibling) {
      return sibling;
    }
  }

  return undefined;
}

import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { useTheme2 } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';

import { changedPanels, type SpecChange } from './specDiff';

/** Marks the root of an embedded dashboard view (`grafana/dashboard-view/v1`). */
const DASHBOARD_VIEW_ATTRIBUTE = 'data-dashboard-view';

/** Marks the element a changed panel's badge renders into. */
const BADGE_ATTRIBUTE = 'data-lifecycle-badge';

/** Marks a panel dimmed because the pending changes leave it as it is. */
const DIMMED_ATTRIBUTE = 'data-lifecycle-dimmed';

/** Marks a panel positioned for a badge in its corner. */
const CORNER_ATTRIBUTE = 'data-lifecycle-corner';

/**
 * The element holding a view's panels, found from an element inside the view's banner: the embedded
 * view's root, or, on the dashboard page, the element around the banner and the dashboard.
 */
export function dashboardViewRoot(anchor: Element | null): Element | null {
  return anchor?.closest(`[${DASHBOARD_VIEW_ATTRIBUTE}]`) ?? anchor?.parentElement ?? null;
}

/**
 * The view's elements matching `selector`. The same dashboard can be open on the page and in an
 * embedded view with the same panel keys, so a view never reaches into another one, nested or not.
 */
export function queryDashboardView(root: Element, selector: string): Element[] {
  const view = root.hasAttribute(DASHBOARD_VIEW_ATTRIBUTE) ? root : null;
  return Array.from(root.querySelectorAll(selector)).filter(
    (el) => el.closest(`[${DASHBOARD_VIEW_ATTRIBUTE}]`) === view
  );
}

/** The selector for a panel by its scene key. */
export function panelSelector(key: string): string {
  return `[data-viz-panel-key="${CSS.escape(key)}"]`;
}

/** Where a changed panel's badge renders, and the change it describes. */
interface ChangeBadgeTarget {
  change: SpecChange;
  mount: HTMLElement;
}

/**
 * The element a panel's badge renders into: right after the panel's title in its header, or, for a
 * panel without a title, over the panel's top-right corner.
 */
function badgeMount(panel: Element, classes: { inline: string; corner: string; cornerHost: string }): HTMLElement {
  const existing = panel.querySelector<HTMLElement>(`[${BADGE_ATTRIBUTE}]`);
  if (existing) {
    return existing;
  }
  const mount = document.createElement('span');
  mount.setAttribute(BADGE_ATTRIBUTE, '');
  const title = panel.querySelector(`[data-testid="${selectors.components.Panels.Panel.headerContainer}"] h2`);
  if (title?.parentElement) {
    mount.className = classes.inline;
    title.parentElement.after(mount);
  } else {
    mount.className = classes.corner;
    panel.classList.add(classes.cornerHost);
    panel.setAttribute(CORNER_ATTRIBUTE, '');
    panel.append(mount);
  }
  return mount;
}

/**
 * Marks the panels pending changes add or edit, in the view `getRoot` returns: a badge beside each
 * one's title, which the caller renders into the returned mounts, and the other panels dimmed. Decorates the rendered panels by their scene key instead of changing scene state, so
 * marking never makes the dashboard dirty.
 */
export function useChangeHighlights(
  dashboard: DashboardScene,
  changes: SpecChange[] | undefined,
  getRoot: () => Element | null
): ChangeBadgeTarget[] {
  const theme = useTheme2();
  const [targets, setTargets] = useState<ChangeBadgeTarget[]>([]);

  useEffect(() => {
    const root = getRoot();
    if (!changes || changes.length === 0 || !root) {
      setTargets([]);
      return;
    }
    const panels = changedPanels(changes);
    const classes = {
      inline: css({ display: 'inline-flex', marginLeft: theme.spacing(1) }),
      corner: css({
        position: 'absolute',
        top: theme.spacing(0.75),
        right: theme.spacing(5),
        zIndex: 1,
      }),
      cornerHost: css({ position: 'relative' }),
    };
    const dimmed = css({ opacity: 0.4 });
    let current: ChangeBadgeTarget[] = [];
    const decorate = () => {
      const next: ChangeBadgeTarget[] = [];
      for (const panel of queryDashboardView(root, '[data-viz-panel-key]')) {
        const change = panels.get(panel.getAttribute('data-viz-panel-key') ?? '');
        if (change) {
          next.push({ change, mount: badgeMount(panel, classes) });
        } else if (!panel.hasAttribute(DIMMED_ATTRIBUTE)) {
          panel.classList.add(dimmed);
          panel.setAttribute(DIMMED_ATTRIBUTE, '');
        }
      }
      // Rendering the badges mutates the view too; only a new or lost mount needs another render.
      const unchanged = next.length === current.length && next.every((target, i) => target.mount === current[i].mount);
      if (!unchanged) {
        current = next;
        setTargets(next);
      }
    };
    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      queryDashboardView(root, `[${BADGE_ATTRIBUTE}]`).forEach((mount) => mount.remove());
      queryDashboardView(root, `[${CORNER_ATTRIBUTE}]`).forEach((panel) => {
        panel.classList.remove(classes.cornerHost);
        panel.removeAttribute(CORNER_ATTRIBUTE);
      });
      queryDashboardView(root, `[${DIMMED_ATTRIBUTE}]`).forEach((panel) => {
        panel.classList.remove(dimmed);
        panel.removeAttribute(DIMMED_ATTRIBUTE);
      });
      setTargets([]);
    };
  }, [dashboard, changes, theme, getRoot]);

  return targets;
}

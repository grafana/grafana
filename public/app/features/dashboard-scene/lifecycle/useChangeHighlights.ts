import { css } from '@emotion/css';
import { useEffect } from 'react';

import { t } from '@grafana/i18n';
import { useTheme2 } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';

import { changedPanelKeys, type SpecChange } from './specDiff';

/** Marks the root of an embedded dashboard view (`grafana/dashboard-view/v1`). */
export const DASHBOARD_VIEW_ATTRIBUTE = 'data-dashboard-view';

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

/**
 * Borders the panels pending changes add or edit, in the view `getRoot` returns. Decorates the
 * rendered panels by their scene key instead of changing scene state, so highlighting never marks
 * the dashboard dirty.
 */
export function useChangeHighlights(
  dashboard: DashboardScene,
  changes: SpecChange[] | undefined,
  getRoot: () => Element | null
) {
  const theme = useTheme2();

  useEffect(() => {
    const root = getRoot();
    if (!changes || changes.length === 0 || !root) {
      return;
    }
    const keys = changedPanelKeys(changes);
    const highlight = (color: string, text: string) =>
      css({
        position: 'relative',
        // Above the panel's header and content, which would cover an outline but for its corners.
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          border: `2px solid ${color}`,
          borderRadius: theme.shape.radius.default,
          pointerEvents: 'none',
          zIndex: 1,
        },
        '&::after': {
          content: JSON.stringify(text),
          position: 'absolute',
          top: theme.spacing(0.75),
          right: theme.spacing(5),
          padding: theme.spacing(0, 0.75),
          borderRadius: theme.shape.radius.default,
          background: color,
          color: theme.colors.getContrastText(color),
          fontSize: theme.typography.bodySmall.fontSize,
          lineHeight: theme.typography.bodySmall.lineHeight,
          pointerEvents: 'none',
          zIndex: 1,
        },
      });
    const added = highlight(theme.colors.success.border, t('dashboard-scene.lifecycle.highlight-new', 'New'));
    const edited = highlight(theme.colors.warning.border, t('dashboard-scene.lifecycle.highlight-edited', 'Edited'));
    const decorate = () => {
      for (const [key, type] of keys) {
        for (const el of queryDashboardView(root, panelSelector(key))) {
          el.classList.add(type === 'added' ? added : edited);
          el.setAttribute('data-lifecycle-change', type);
        }
      }
    };
    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      queryDashboardView(root, '[data-lifecycle-change]').forEach((el) => {
        el.classList.remove(added, edited);
        el.removeAttribute('data-lifecycle-change');
      });
    };
  }, [dashboard, changes, theme, getRoot]);
}

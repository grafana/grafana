import { css, keyframes } from '@emotion/css';

import { config } from '@grafana/runtime';
import { type VizPanel } from '@grafana/scenes';

import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';

export const FOCUS_HIGHLIGHT_MS = 2000;
// The panel may render a moment after its tab is switched or its row expanded.
const FIND_ELEMENT_ATTEMPTS = 30;

/**
 * Scrolls a panel into view, switching tabs and expanding rows on the way, and highlights it
 * briefly so the user sees where it is.
 */
export function focusVizPanel(panel: VizPanel) {
  const item = panel.parent;
  if (item instanceof DashboardGridItem || item instanceof AutoGridItem) {
    item.scrollIntoView();
  }
  highlightWhenRendered(panel, FIND_ELEMENT_ATTEMPTS);
}

function highlightWhenRendered(panel: VizPanel, attemptsLeft: number) {
  const element = panel.state.key ? document.querySelector(`[data-viz-panel-key="${panel.state.key}"]`) : null;
  if (element instanceof HTMLElement) {
    const className = getHighlightClass();
    element.classList.add(className);
    setTimeout(() => element.classList.remove(className), FOCUS_HIGHLIGHT_MS);
    return;
  }
  if (attemptsLeft > 0) {
    requestAnimationFrame(() => highlightWhenRendered(panel, attemptsLeft - 1));
  }
}

function getHighlightClass() {
  const theme = config.theme2;
  const pulse = keyframes({
    from: { boxShadow: `0 0 0 0 ${theme.colors.primary.main}` },
    to: { boxShadow: `0 0 0 ${theme.spacing(1.5)} transparent` },
  });
  return css({
    outline: `2px solid ${theme.colors.primary.border}`,
    outlineOffset: 2,
    borderRadius: theme.shape.radius.default,
    [theme.transitions.handleMotion('no-preference')]: {
      animation: `${pulse} 1s ease-out 2`,
    },
  });
}

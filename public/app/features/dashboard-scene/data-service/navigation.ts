import { dateTime } from '@grafana/data';
import { config } from '@grafana/runtime';
import { type VizPanel } from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';
import { getExploreUrl } from 'app/core/utils/explore';

import { VizPanelEditableElement } from '../sidebar/VizPanelEditableElement';
import { getDatasourceFromQueryRunner } from '../utils/getDatasourceFromQueryRunner';
import { getQueryRunnerFor } from '../utils/getQueryRunnerFor';

/** Long enough for a tab switch or row expansion to render the panel before it is highlighted. */
const HIGHLIGHT_DELAY_MS = 400;
const HIGHLIGHT_DURATION_MS = 1600;

/** Scrolls to a panel, switching tabs and expanding rows as needed, and briefly outlines it. */
export function revealVizPanel(panel: VizPanel) {
  new VizPanelEditableElement(panel).scrollIntoView();
  const key = panel.state.key;
  if (!key) {
    return;
  }
  setTimeout(() => {
    const element = document.querySelector(`[data-viz-panel-key="${CSS.escape(key)}"]`);
    if (!(element instanceof HTMLElement) || typeof element.animate !== 'function') {
      return;
    }
    const color = config.theme2.colors.primary.border;
    element.animate([{ outline: `2px solid ${color}` }, { outline: '2px solid transparent' }], {
      duration: HIGHLIGHT_DURATION_MS,
      easing: 'ease-out',
    });
  }, HIGHLIGHT_DELAY_MS);
}

/** Explore with the panel's queries over a window, without changing the dashboard. */
export function getVizPanelExploreUrl(
  panel: VizPanel,
  timeWindow: { from: string; to: string }
): Promise<string | undefined> {
  const queryRunner = getQueryRunnerFor(panel);
  if (!contextSrv.hasAccessToExplore() || !queryRunner) {
    return Promise.resolve(undefined);
  }
  const from = dateTime(timeWindow.from);
  const to = dateTime(timeWindow.to);
  return getExploreUrl({
    queries: queryRunner.state.queries,
    dsRef: getDatasourceFromQueryRunner(queryRunner),
    timeRange: { from, to, raw: { from, to } },
    scopedVars: { __sceneObject: { value: panel } },
    adhocFilters: queryRunner.state.data?.request?.filters,
  });
}

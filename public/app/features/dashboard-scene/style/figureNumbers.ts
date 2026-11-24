import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { SceneObjectStateChangedEvent } from '@grafana/scenes';

import { type DashboardScene } from '../scene/DashboardScene';

const PANEL_TITLE = `[data-testid="${selectors.components.Panels.Panel.headerContainer}"] h2`;

/** Keys of titled panels in reading order; a figure number is its position here, from one. */
export function getFigureKeys(dashboard: DashboardScene): string[] {
  return dashboard.state.body
    .getVizPanels()
    .filter((panel) => panel.state.title.trim() !== '' && panel.state.key)
    .map((panel) => panel.state.key!);
}

/**
 * A class numbering the dashboard's titled panels "Fig. 1", "Fig. 2"… in layout order. CSS counters
 * cannot do this: the layouts' size containers scope counters to each one, restarting the count.
 */
export function useFigureNumberClass(dashboard: DashboardScene, enabled: boolean): string | undefined {
  const [signature, setSignature] = useState(() => getFigureKeys(dashboard).join('\n'));

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const sub = dashboard.subscribeToEvent(SceneObjectStateChangedEvent, () =>
      setSignature(getFigureKeys(dashboard).join('\n'))
    );
    return () => sub.unsubscribe();
  }, [dashboard, enabled]);

  return useMemo(() => {
    if (!enabled || !signature) {
      return undefined;
    }
    const rules: Record<string, { content: string }> = {};
    signature.split('\n').forEach((key, index) => {
      rules[`& [data-viz-panel-key="${key.replace(/["\\]/g, '')}"] ${PANEL_TITLE}::before`] = {
        content: `${JSON.stringify(t('dashboard.style.figure-number', 'Fig. {{number}}', { number: index + 1 }))} "\\2002"`,
      };
    });
    return css({ label: 'dashboard-figure-numbers', ...rules });
  }, [enabled, signature]);
}

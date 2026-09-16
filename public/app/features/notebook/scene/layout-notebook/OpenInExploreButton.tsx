import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { LinkButton, Stack } from '@grafana/ui';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';
import { tryGetExploreUrlForPanel } from 'app/features/dashboard-scene/utils/urlBuilders';

/**
 * Takes a visualization cell's queries to Explore. Dashboard panels reach Explore through their kebab
 * menu, which notebook panels don't have: buildVizPanelState leaves `menu` unset because the dashboard
 * chrome would throw without a DashboardScene ancestor.
 */
export function OpenInExploreButton({ panel }: { panel: VizPanel }) {
  const [url, setUrl] = useState<string>();
  const queryRunner = getQueryRunnerFor(panel);
  // setQueryRunnerQueries mutates the runner rather than replacing it, so this tracks query edits.
  const { queries } = queryRunner?.useState() ?? { queries: [] };
  const timeRange = sceneGraph.getTimeRange(panel).useState().value;

  useEffect(() => {
    let active = true;
    // Resolved up front so this can be a real anchor: a window.open issued after an await is at the
    // mercy of the popup blocker once the click's transient activation has lapsed.
    tryGetExploreUrlForPanel(panel).then((next) => {
      if (active) {
        setUrl(next);
      }
    });

    return () => {
      active = false;
    };
  }, [panel, queries, timeRange]);

  // No access to Explore, no query runner, or no queries — nothing to open, so nothing to show.
  if (!url) {
    return null;
  }

  return (
    <Stack justifyContent="flex-end" alignItems="center">
      <LinkButton
        variant="secondary"
        fill="text"
        size="sm"
        icon="compass"
        href={url}
        target="_blank"
        // LinkButton spreads props onto its anchor and adds no rel of its own, unlike Menu.Item.
        rel="noopener noreferrer"
      >
        {t('notebook.cell.panel.open-in-explore', 'Explore')}
      </LinkButton>
    </Stack>
  );
}

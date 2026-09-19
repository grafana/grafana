import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { sceneGraph, type SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { LinkButton } from '@grafana/ui';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';
import { tryGetExploreUrlForPanel } from 'app/features/dashboard-scene/utils/urlBuilders';

/**
 * Takes a visualization cell's queries to Explore. Dashboard panels reach Explore through their kebab
 * menu, which notebook panels don't have: buildVizPanelState leaves `menu` unset because the dashboard
 * chrome would throw without a DashboardScene ancestor.
 */
export function OpenInExploreButton({ panel }: { panel: VizPanel }) {
  // A library panel starts with no $data and installs its runner asynchronously, with a setState on
  // the panel — so this subscription is what brings the link with it. Resolving the runner here also
  // keeps the hook count fixed: subscribing to it conditionally would run more hooks on the render
  // after it arrives than on the one before.
  panel.useState();

  const queryRunner = getQueryRunnerFor(panel);
  if (!queryRunner) {
    return null;
  }

  return <ExploreLink panel={panel} queryRunner={queryRunner} />;
}

function ExploreLink({ panel, queryRunner }: { panel: VizPanel; queryRunner: SceneQueryRunner }) {
  const [url, setUrl] = useState<string>();
  // setQueryRunnerQueries mutates the runner rather than replacing it, so this tracks query edits.
  const { queries } = queryRunner.useState();
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

  // No access to Explore, or a panel that takes no queries — nothing to open, so nothing to show.
  if (!url) {
    return null;
  }

  return (
    <LinkButton
      variant="secondary"
      fill="text"
      size="sm"
      icon="compass"
      tooltip={t('notebook.cell.panel.open-in-explore', 'Explore')}
      href={url}
      target="_blank"
      // LinkButton spreads props onto its anchor and adds no rel of its own, unlike Menu.Item.
      rel="noopener noreferrer"
    />
  );
}

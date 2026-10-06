import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { sceneGraph, type SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { LinkButton } from '@grafana/ui';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';
import { tryGetExploreUrlForPanel } from 'app/features/dashboard-scene/utils/urlBuilders';

/**
 * A notebook panel has no kebab menu (buildVizPanelState leaves `menu` unset - it assumes a
 * DashboardScene ancestor a notebook cell doesn't have), so this is its Explore link instead.
 */
export function OpenInExploreButton({ panel }: { panel: VizPanel }) {
  // A library panel starts with no $data and attaches its runner later via a setState on the panel —
  // staying subscribed here is what picks that up, rather than resolving the runner once on mount.
  panel.useState();

  const queryRunner = getQueryRunnerFor(panel);
  if (!queryRunner) {
    return null;
  }

  return <ExploreLink panel={panel} queryRunner={queryRunner} />;
}

function ExploreLink({ panel, queryRunner }: { panel: VizPanel; queryRunner: SceneQueryRunner }) {
  const [url, setUrl] = useState<string>();
  // setQueryRunnerQueries mutates the runner in place rather than replacing it, so the query edit
  // itself has to be watched directly - the runner reference never changes to re-trigger this.
  const { queries } = queryRunner.useState();
  const timeRange = sceneGraph.getTimeRange(panel).useState().value;

  useEffect(() => {
    let current = true;
    void tryGetExploreUrlForPanel(panel).then((next) => {
      if (current) {
        setUrl(next);
      }
    });
    return () => {
      current = false;
    };
  }, [panel, queries, timeRange]);

  // No access to Explore, or a panel with nothing to query - either way, nothing to open.
  if (!url) {
    return null;
  }

  return (
    <LinkButton
      variant="secondary"
      fill="text"
      size="sm"
      icon="compass"
      tooltip={t('notebook.cell.panel.open-in-explore', 'Open in Explore')}
      href={url}
      target="_blank"
      // LinkButton spreads extra props onto its anchor but adds no rel of its own.
      rel="noopener noreferrer"
    />
  );
}

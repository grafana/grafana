import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { sceneGraph, type SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { LinkButton } from '@grafana/ui';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';
import { tryGetExploreUrlForPanel } from 'app/features/dashboard-scene/utils/urlBuilders';

/** A notebook panel has no kebab menu, so this is its Explore link instead. */
export function OpenInExploreButton({ panel }: { panel: VizPanel }) {
  // Picks up a library panel's runner, attached later via setState.
  panel.useState();

  const queryRunner = getQueryRunnerFor(panel);
  if (!queryRunner) {
    return null;
  }

  return <ExploreLink panel={panel} queryRunner={queryRunner} />;
}

function ExploreLink({ panel, queryRunner }: { panel: VizPanel; queryRunner: SceneQueryRunner }) {
  const [url, setUrl] = useState<string>();
  // Watched directly: setQueryRunnerQueries mutates the runner rather than replacing it.
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
      rel="noopener noreferrer" // LinkButton adds no rel of its own
    />
  );
}

import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { CoreApp, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceInstance } from '@grafana/runtime';
import { sceneGraph, type SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';
import { tryGetExploreUrlForPanel } from 'app/features/dashboard-scene/utils/urlBuilders';

export function PanelExploreLink({ panel }: { panel: VizPanel }) {
  const runner = getQueryRunnerFor(panel);
  if (!runner) {
    return null;
  }
  return <PanelExploreLinkWithRunner panel={panel} runner={runner} />;
}

function useExploreUrl(panel: VizPanel, runner: SceneQueryRunner) {
  const { queries, datasource } = runner.useState();
  const { value: range } = sceneGraph.getTimeRange(panel).useState();
  const { pluginId } = panel.useState();
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setUrl(undefined);
    if (queries.length > 0) {
      void Promise.all(
        queries.map(async (query) => {
          if (query.queryType) {
            return query;
          }
          try {
            const queryDatasource = await getDataSourceInstance(query.datasource ?? datasource);
            if (queryDatasource.uid !== 'grafana') {
              return query;
            }
            const queryType = queryDatasource.getDefaultQuery?.(CoreApp.Explore)?.queryType;
            return queryType ? { ...query, queryType } : query;
          } catch {
            return query;
          }
        })
      )
        .then((exploreQueries) => tryGetExploreUrlForPanel(panel, exploreQueries))
        .then((nextUrl) => {
          if (!cancelled) {
            setUrl(nextUrl);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setUrl(undefined);
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [panel, queries, datasource, range, pluginId]);

  return url;
}

function PanelExploreLinkWithRunner({ panel, runner }: { panel: VizPanel; runner: SceneQueryRunner }) {
  const url = useExploreUrl(panel, runner);
  const styles = useStyles2(getStyles);
  return url ? (
    <LinkButton
      icon="compass"
      size="sm"
      variant="secondary"
      fill="text"
      className={styles.exploreLink}
      tooltip={t('notebooks.panel.open-explore', 'Open in Explore')}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    />
  ) : null;
}

const getStyles = (theme: GrafanaTheme2) => ({
  exploreLink: css({
    border: 0,
    height: 22,
    marginLeft: theme.spacing(-0.5),
    padding: theme.spacing(0.5),
    '& svg': { margin: 0 },
  }),
});

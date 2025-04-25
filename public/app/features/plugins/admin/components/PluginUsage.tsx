import { css } from '@emotion/css';
import { useMemo } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { of } from 'rxjs';

import { GrafanaTheme2, PluginMeta, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, Spinner, useStyles2 } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { t, Trans } from 'app/core/internationalization';
import { SearchResultsTable } from 'app/features/search/page/components/SearchResultsTable';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { SearchQuery } from 'app/features/search/service/types';

type Props = {
  plugin: PluginMeta;
};

export function PluginUsage({ plugin }: Props) {
  const styles = useStyles2(getStyles);

  const searchQuery = useMemo<SearchQuery>(() => {
    if (plugin.type === PluginType.datasource) {
      return {
        query: '*',
        ds_type: plugin.id,
        kind: ['dashboard'],
      };
    }
    return {
      query: '*',
      panel_type: plugin.id,
      kind: ['panel'],
    };
  }, [plugin]);

  const results = useAsync(() => {
    return getGrafanaSearcher().search(searchQuery);
  }, [searchQuery]);

  const found = results.value;
  if (found?.totalRows) {
    return (
      <div className={styles.wrap}>
        <div className={styles.info}>
          <Trans
            i18nKey="plugins.plugin-usage.num-usages"
            values={{ pluginName: plugin.name, numUsages: found.totalRows }}
          >
            {'{{pluginName}}'} is used <b>{'{{numUsages}}'}</b> times.
          </Trans>
        </div>
        <AutoSizer>
          {({ width, height }) => {
            return (
              <SearchResultsTable
                response={found}
                width={width}
                height={height}
                clearSelection={() => {}}
                keyboardEvents={of()}
                onTagSelected={() => {}}
              />
            );
          }}
        </AutoSizer>
      </div>
    );
  }

  if (results.loading) {
    return <Spinner />;
  }

  if (!config.featureToggles.panelTitleSearch) {
    return (
      <Alert
        title={t(
          'plugins.plugin-usage.title-missing-feature-toggle-panel-title-search',
          'Missing feature toggle: {{toggle}}',
          { toggle: 'panelTitleSearch' }
        )}
        severity="warning"
      >
        <Trans i18nKey="plugins.plugin-usage.body-missing-feature-toggle-panel-title-search">
          Plugin usage requires the new search index to find usage across dashboards. Please enable the feature toggle
        </Trans>
      </Alert>
    );
  }

  return (
    <EmptyListCTA
      title={t('plugins.plugin-usage.title-not-used-yet', '{{pluginName}} is not used in any dashboards yet', {
        pluginName: plugin.name,
      })}
      buttonIcon="plus"
      buttonTitle="Create Dashboard"
      buttonLink={`dashboard/new?panelType=${plugin.id}&editPanel=1`}
    />
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrap: css({
      width: '100%',
      height: '90%',
    }),
    info: css({
      paddingBottom: '30px',
    }),
  };
};

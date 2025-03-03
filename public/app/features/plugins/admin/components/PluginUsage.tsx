import { css } from '@emotion/css';
import { useMemo } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { of } from 'rxjs';

import { GrafanaTheme2, PluginMeta, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, Spinner, useStyles2 } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
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
          {plugin.name} is used <b>{found.totalRows}</b> times.
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
      <Alert title="Missing feature toggle: panelTitleSearch">
        Plugin usage requires the new search index to find usage across dashboards
      </Alert>
    );
  }

  return (
    <EmptyListCTA
      title={`${plugin.name} is not used in any dashboards yet`}
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

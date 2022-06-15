import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { of } from 'rxjs';

import { GrafanaTheme2, PluginMeta } from '@grafana/data';
import { Spinner, useStyles2 } from '@grafana/ui';
import { SearchResultsTable } from 'app/features/search/page/components/SearchResultsTable';
import { getGrafanaSearcher, SearchQuery } from 'app/features/search/service';

type Props = {
  plugin: PluginMeta;
};

export function PluginUsage({ plugin }: Props) {
  const styles = useStyles2(getStyles);

  const searchQuery = useMemo(() => {
    return {
      query: '*',
      panel_type: plugin.id,
      kind: ['panel'],
    } as SearchQuery;
  }, [plugin]);

  const results = useAsync(() => {
    return getGrafanaSearcher().search(searchQuery);
  }, [searchQuery]);

  if (results.value?.totalRows) {
    return (
      <div className={styles.wrap}>
        <AutoSizer>
          {({ width, height }) => {
            return (
              <SearchResultsTable
                response={results.value!}
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

  return <div className="gf-form-group">Nothing found for {plugin.id}</div>;
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrap: css`
      width: 100%;
      height: 100%;
    `,
  };
};

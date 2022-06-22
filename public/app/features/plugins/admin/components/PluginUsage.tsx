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
      facet: [
        {
          field: 'location',
        },
      ],
    } as SearchQuery;
  }, [plugin]);

  const results = useAsync(() => {
    return getGrafanaSearcher().search(searchQuery);
  }, [searchQuery]);

  console.log(results);
  const found = results.value;
  if (found?.totalRows) {
    return (
      <div className={styles.wrap}>
        <div className={styles.info}>
          Plugin is used <b>{found.totalRows}</b> times
          {Boolean(found.facets?.length) && (
            <span>
              , in <b>{found.facets![0].length}</b> dashboards
            </span>
          )}
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

  return <div className="gf-form-group">Nothing found for {plugin.id}</div>;
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrap: css`
      width: 100%;
      height: 100%;
    `,
    info: css`
      padding-bottom: 30px;
    `,
  };
};

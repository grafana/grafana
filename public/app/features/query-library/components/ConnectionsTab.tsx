import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { useAsync } from 'react-use';
import { of } from 'rxjs';

import { DataQuery, GrafanaTheme2 } from '@grafana/data/src';
import { Spinner, useStyles2 } from '@grafana/ui/src';

import { SearchResultsTable } from '../../search/page/components/SearchResultsTable';
import { getGrafanaSearcher, SearchQuery } from '../../search/service';
import { SavedQuery } from '../api/SavedQueriesApi';

type Props = {
  savedQuery: SavedQuery<DataQuery>;
};

export const ConnectionsTab = (props: Props) => {
  const styles = useStyles2(getStyles);

  const searchQuery = useMemo<SearchQuery>(() => {
    const query: SearchQuery = {
      query: '*',
      kind: ['dashboard'],
      saved_query_uid: props.savedQuery.uid,
    };

    return query;
  }, [props.savedQuery.uid]);

  const results = useAsync(async () => {
    return await getGrafanaSearcher().search(searchQuery);
  }, [searchQuery]);

  if (results.loading) {
    return <Spinner />;
  }

  const found = results.value;

  if (!found?.totalRows) {
    return <>This query is not used anywhere</>;
  }

  return (
    <div className={styles.wrap}>
      <SearchResultsTable
        response={found}
        width={500} // TODO ?????
        height={800}
        clearSelection={() => {}}
        keyboardEvents={of()}
        onTagSelected={() => {}}
      />
    </div>
  );
};

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

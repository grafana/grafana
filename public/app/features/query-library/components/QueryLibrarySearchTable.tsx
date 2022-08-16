import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { of } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data';
import { DataQuery } from '@grafana/data/src/types/query';
import { selectors } from '@grafana/e2e-selectors';
import { Button, FilterInput, HorizontalGroup, LinkButton, ModalsController, Spinner, useStyles2 } from '@grafana/ui';

import { SearchResultsTable } from '../../search/page/components/SearchResultsTable';
import { getGrafanaSearcher, SearchQuery } from '../../search/service';
import { SavedQuery } from '../api/SavedQueriesApi';
import { getSavedQuerySrv } from '../api/SavedQueriesSrv';

import { DatasourceTypePicker } from './DatasourceTypePicker';
import { QueryEditorDrawer } from './QueryEditorDrawer';

const QueryLibrarySearchTable = () => {
  const styles = useStyles2(getStyles);

  const [datasourceType, setDatasourceType] = useState<string | null>(null);
  const [searchQueryBy, setSearchByQuery] = useState<string>('');
  const [savedQuery, setSavedQuery] = useState<SavedQuery<DataQuery>>();

  const searchQuery = useMemo<SearchQuery>(() => {
    const query: SearchQuery = {
      query: '*',
      explain: true,
      kind: ['query'],
    };

    if (datasourceType?.length) {
      query.ds_type = datasourceType;
    }

    if (searchQueryBy) {
      query.query = searchQueryBy;
    }

    return query;
  }, [datasourceType, searchQueryBy]);

  const results = useAsync(() => {
    return getGrafanaSearcher().search(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const loadQuery = async () => {
      const result = await getSavedQuerySrv().getSavedQueryByUids([{ uid: 'system/queries/ds-variables.json' }]);
      setSavedQuery(result[0]);
    };

    loadQuery();
  }, []);

  if (results.loading) {
    return <Spinner />;
  }

  const found = results.value;
  return (
    <div className={styles.tableWrapper}>
      <HorizontalGroup width="100%" justify="space-between" spacing={'md'} height={25}>
        <HorizontalGroup>
          <FilterInput
            placeholder="Search queries by name, source, or variable"
            autoFocus={true}
            value={searchQueryBy}
            onChange={setSearchByQuery}
            width={50}
            className={styles.searchBy}
          />
          Filter by datasource type
          <DatasourceTypePicker
            current={datasourceType}
            onChange={(newDsType) => {
              setDatasourceType(() => newDsType);
            }}
          />
        </HorizontalGroup>

        <div className={styles.createQueryButton}>
          <LinkButton size="md" href={`query-library/new`} icon="plus" title="Create Query">
            {'Create Query'}
          </LinkButton>
          <ModalsController>
            {({ showModal, hideModal }) => {
              return (
                savedQuery && (
                  <Button
                    onClick={() => {
                      showModal(QueryEditorDrawer, {
                        onDismiss: hideModal,
                        savedQuery,
                      });
                    }}
                    aria-label={selectors.pages.Dashboard.Settings.General.saveDashBoard}
                  >
                    Open query editor drawer
                  </Button>
                )
              );
            }}
          </ModalsController>
        </div>
      </HorizontalGroup>

      <AutoSizer className={styles.table} style={{ width: '100%', height: '100%' }}>
        {({ width, height }) => {
          return (
            <SearchResultsTable
              response={found!}
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
};

export default QueryLibrarySearchTable;

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    tableWrapper: css`
      height: 100%;
      margin-top: 20px;
      margin-bottom: 20px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    `,
    table: css`
      margin-top: 40px;
    `,
    createQueryButton: css`
      text-align: center;
    `,
    filtersGroup: css`
      padding-top: 10px;
      margin-top: 30px;
    `,
    searchBy: css`
      margin-right: 15px;
    `,
  };
};

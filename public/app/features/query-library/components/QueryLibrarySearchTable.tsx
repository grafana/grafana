import { css, cx } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { DataQuery } from '@grafana/data/src/types/query';
import { selectors } from '@grafana/e2e-selectors';
import { Button, FilterInput, HorizontalGroup, LinkButton, ModalsController, Spinner, useStyles2 } from '@grafana/ui';

import { getGrafanaSearcher, SearchQuery } from '../../search/service';
import { SavedQuery } from '../api/SavedQueriesApi';
import { getSavedQuerySrv } from '../api/SavedQueriesSrv';
import { QueryItem } from '../types';

import { DatasourceTypePicker } from './DatasourceTypePicker';
import { QueryEditorDrawer } from './QueryEditorDrawer';
import { QueryListItem } from './QueryListItem';

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

  const results = useAsync(async () => {
    const raw = await getGrafanaSearcher().search(searchQuery);
    return raw.view.map<QueryItem>((item) => ({
      uid: item.uid,
      title: item.name,
      url: item.url,
      uri: item.url,
      type: item.kind,
      id: 123, // do not use me!
      tags: item.tags ?? [],
      ds_uid: item.ds_uid,
    }));
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

      <AutoSizer className={styles.autosizer} style={{ width: '100%', height: '100%' }}>
        {({ width, height }) => {
          return (
            <table className={cx('filter-table form-inline filter-table--hover', styles.table)}>
              <thead>
                <tr>
                  <th></th>
                  <th>Status</th>
                  <th>Name and raw query</th>
                  <th>Data Source</th>
                  <th>User</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {found!.map((item) => {
                  return <QueryListItem query={item} key={item.uid} />;
                })}
              </tbody>
            </table>
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
    autosizer: css`
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
    table: css`
      font-size: 14px;
      &tbody {
        &tr: {
          background: ${theme.colors.background.secondary};
        }
      }
    `,
  };
};

import { css, cx } from '@emotion/css';
import { Global } from '@emotion/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, FilterInput, HorizontalGroup, ModalsController, useStyles2, useTheme2 } from '@grafana/ui';

import { getGrafanaSearcher, SearchQuery } from '../../search/service';
import { getGlobalStyles } from '../globalStyles';
import { QueryItem } from '../types';

import { DatasourceTypePicker } from './DatasourceTypePicker';
import { QueryCreateDrawer } from './QueryCreateDrawer';
import { QueryListItem } from './QueryListItem';

const QueryLibrarySearchTable = () => {
  const styles = useStyles2(getStyles);

  const [datasourceType, setDatasourceType] = useState<string | null>(null);
  const [searchQueryBy, setSearchByQuery] = useState<string>('');
  const [reload, setReload] = useState(0);

  const theme = useTheme2();
  const globalCSS = getGlobalStyles(theme);

  // @TODO update with real data
  const authors = ['Artur Wierzbicki', 'Drew Slobodnjak', 'Nathan Marrs', 'Raphael Batyrbaev', 'Adela Almasan'];
  const dates = [
    'August 17, 2022, 2:32pm',
    'August 17, 2022, 4:10pm',
    'August 18, 2022, 1:00am',
    'August 18, 2022, 12:00pm',
    'August 19, 2022, 2:33pm',
  ];

  const searchQuery = useMemo<SearchQuery>(() => {
    const query: SearchQuery = {
      query: '*',
      sort: 'name_sort',
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

  useEffect(() => {}, [reload]);

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
  }, [searchQuery, reload]);

  const found = results.value;
  return (
    <>
      <Global styles={globalCSS} />
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
          <ModalsController>
            {({ showModal, hideModal }) => {
              return (
                <div className={styles.createQueryButton}>
                  <Button
                    icon="plus"
                    size="md"
                    onClick={() => {
                      showModal(QueryCreateDrawer, {
                        onDismiss: hideModal,
                        updateComponent: () => {
                          setReload(reload + 1);
                        },
                      });
                    }}
                  >
                    Create query
                  </Button>
                </div>
              );
            }}
          </ModalsController>
        </HorizontalGroup>

        <ModalsController>
          {({ showModal, hideModal }) => {
            return (
              <AutoSizer className={styles.autosizer} style={{ width: '100%', height: '100%' }}>
                {({ width, height }) => {
                  return (
                    <table className={cx('filter-table form-inline filter-table--hover', styles.table)}>
                      <thead>
                        <tr>
                          <th />
                          <th>Status</th>
                          <th>Name and raw query</th>
                          <th>Data Source</th>
                          <th>User</th>
                          <th>Date</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {!Boolean(found?.length) && (
                          <tr className={styles.transparentBg}>
                            <td />
                            <td />
                            <td />
                            <td>
                              <div className={styles.noData}>No data</div>
                            </td>
                            <td />
                            <td />
                            <th />
                          </tr>
                        )}
                        {Boolean(found?.length) &&
                          found!.map((item, key) => {
                            return (
                              <QueryListItem
                                query={item}
                                key={item.uid}
                                showModal={showModal}
                                hideModal={hideModal}
                                updateComponent={() => setReload(reload + 1)}
                                author={key < authors.length ? authors[key] : authors[key - authors.length]}
                                date={key < dates.length ? dates[key] : dates[key - dates.length]}
                              />
                            );
                          })}
                      </tbody>
                    </table>
                  );
                }}
              </AutoSizer>
            );
          }}
        </ModalsController>
      </div>
    </>
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
    noData: css`
      color: ${theme.colors.text.secondary};
    `,
    transparentBg: css`
      background: transparent !important;
    `,
  };
};

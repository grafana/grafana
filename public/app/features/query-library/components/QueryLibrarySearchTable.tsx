import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { of } from 'rxjs';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime/src';
import { LinkButton, Spinner, useStyles2 } from '@grafana/ui';

import { SearchResultsTable } from '../../search/page/components/SearchResultsTable';
import { getGrafanaSearcher, SearchQuery } from '../../search/service';

import { DatasourceTypePicker } from './DatasourceTypePicker';

const QueryLibrarySearchTable = () => {
  const styles = useStyles2(getStyles);

  const [datasourceType, setDatasourceType] = useState<string | null>(null);
  const [dsInstanceSettings, setDsInstanceSettings] = useState<DataSourceInstanceSettings | null>(null);

  const searchQuery = useMemo<SearchQuery>(() => {
    const query: SearchQuery = {
      query: '*',
      explain: true,
      kind: ['query'],
    };

    if (datasourceType?.length) {
      query.ds_type = datasourceType;
    }

    if (dsInstanceSettings?.uid) {
      query.ds_uid = dsInstanceSettings?.uid;
    }

    return query;
  }, [datasourceType, dsInstanceSettings?.uid]);

  const results = useAsync(() => {
    return getGrafanaSearcher().search(searchQuery);
  }, [searchQuery]);

  if (results.loading) {
    return <Spinner />;
  }

  const found = results.value;
  return (
    <div className={styles.tableWrapper}>
      <div className={styles.createQueryButton}>
        <LinkButton size="md" href={`query-library/new`} icon="plus" title="Create Query">
          {'Create Query'}
        </LinkButton>
      </div>
      Datasource type
      <DatasourceTypePicker
        current={datasourceType}
        onChange={(newDsType) => {
          setDatasourceType(() => newDsType);
          if (dsInstanceSettings) {
            if (dsInstanceSettings.type !== newDsType) {
              setDsInstanceSettings(() => null);
            }
          }
        }}
      />
      Datasource uid
      <DataSourcePicker
        noDefault={true}
        current={dsInstanceSettings?.uid}
        onClear={() => {
          setDsInstanceSettings(() => null);
        }}
        onChange={(newDs) => {
          setDsInstanceSettings(() => newDs);
        }}
        filter={(dsSettings) => {
          if (!datasourceType?.length) {
            return true;
          }

          return dsSettings.type === datasourceType;
        }}
      />
      <div className={styles.table}>
        <AutoSizer>
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
    </div>
  );
};

export default QueryLibrarySearchTable;

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    tableWrapper: css`
      height: 100%;
    `,
    table: css`
      width: 100%;
      height: 100%;
    `,
    createQueryButton: css`
      text-align: center;
    `,
  };
};

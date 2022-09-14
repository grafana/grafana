import { css } from '@emotion/css';
import { noop } from 'lodash';
import React, { FC, useCallback, useMemo } from 'react';
import { useAsync } from 'react-use';

import { CoreApp, DataQuery, DataSourceInstanceSettings, GrafanaTheme2, LoadingState } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import { LokiQuery } from 'app/plugins/datasource/loki/types';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';

import { CloudAlertPreview } from './CloudAlertPreview';
import { usePreview } from './PreviewRule';

export interface ExpressionEditorProps {
  value?: string;
  onChange: (value: string) => void;
  dsSettings: DataSourceInstanceSettings; // will be a prometheus or loki datasource
}

export const ExpressionEditor: FC<ExpressionEditorProps> = ({ value, onChange, dsSettings }) => {
  const styles = useStyles2(getStyles);

  const { mapToValue, mapToQuery } = useQueryMappers(dsSettings.name);
  const dataQuery = mapToQuery({ refId: 'A', hide: false }, value);

  const {
    error,
    loading,
    value: dataSource,
  } = useAsync(() => {
    return getDataSourceSrv().get(dsSettings);
  }, [dsSettings]);

  const onChangeQuery = useCallback(
    (query: DataQuery) => {
      onChange(mapToValue(query));
    },
    [onChange, mapToValue]
  );

  const [alertPreview, onPreview] = usePreview();

  const onRunQueriesClick = async () => {
    onPreview();
  };

  if (loading || dataSource?.name !== dsSettings.name) {
    return null;
  }

  if (error || !dataSource || !dataSource?.components?.QueryEditor) {
    const errorMessage = error?.message || 'Data source plugin does not export any Query Editor component';
    return <div>Could not load query editor due to: {errorMessage}</div>;
  }

  const previewLoaded = alertPreview?.data.state === LoadingState.Done;
  // The preview API returns arrays with empty elements when there are no firing alerts
  const previewHasAlerts = alertPreview?.data.series.every((frame) =>
    frame.fields.every((field) => field.values.length > 0)
  );

  const QueryEditor = dataSource?.components?.QueryEditor;

  const previewSeries = alertPreview?.data.series ?? [];

  return (
    <>
      <QueryEditor
        query={dataQuery}
        queries={[dataQuery]}
        app={CoreApp.CloudAlerting}
        onChange={onChangeQuery}
        onRunQuery={noop}
        datasource={dataSource}
      />

      <div className={styles.preview}>
        <Button type="button" onClick={onRunQueriesClick} disabled={alertPreview?.data.state === LoadingState.Loading}>
          Preview alerts
        </Button>
        {previewLoaded && (
          <Alert title="Alerts preview" severity="info" className={styles.previewAlert}>
            {previewHasAlerts ? (
              <>Preview based on the result of running the query for this moment.</>
            ) : (
              <>There are no firing alerts for your query.</>
            )}
          </Alert>
        )}
        {previewHasAlerts && <CloudAlertPreview previewSeries={previewSeries} />}
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  preview: css`
    padding: ${theme.spacing(2, 0)};
    max-width: ${theme.breakpoints.values.md}px;
  `,
  previewAlert: css`
    margin: ${theme.spacing(1, 0)};
  `,
});

type QueryMappers<T extends DataQuery = DataQuery> = {
  mapToValue: (query: T) => string;
  mapToQuery: (existing: T, value: string | undefined) => T;
};

function useQueryMappers(dataSourceName: string): QueryMappers {
  return useMemo(() => {
    const settings = getDataSourceSrv().getInstanceSettings(dataSourceName);

    switch (settings?.type) {
      case 'loki':
      case 'prometheus':
        return {
          mapToValue: (query: DataQuery) => (query as PromQuery | LokiQuery).expr,
          mapToQuery: (existing: DataQuery, value: string | undefined) => ({ ...existing, expr: value }),
        };
      default:
        throw new Error(`${dataSourceName} is not supported as an expression editor`);
    }
  }, [dataSourceName]);
}

import { css } from '@emotion/css';
import { noop } from 'lodash';
import React, { FC, useCallback, useMemo } from 'react';
import { useAsync, useAsyncFn } from 'react-use';
import { lastValueFrom } from 'rxjs';

import {
  CoreApp,
  DataFrameJSON,
  DataQuery,
  DataSourceInstanceSettings,
  FieldSchema,
  GrafanaTheme2,
} from '@grafana/data';
import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { Alert, Button, Icon, TagList, Tooltip, useStyles2 } from '@grafana/ui';
import { LokiQuery } from 'app/plugins/datasource/loki/types';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';

import { isGrafanaAlertState } from '../../../../../types/unified-alerting-dto';
import { AlertStateTag } from '../rules/AlertStateTag';

export interface ExpressionEditorProps {
  value?: string;
  onChange: (value: string) => void;
  dsSettings: DataSourceInstanceSettings; // will be a prometheus or loki datasource
}

interface CloudRulePreviewResponse {
  instances: DataFrameJSON[];
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

  const [previewState, fetchPreview] = useAsyncFn(() => {
    return lastValueFrom(
      getBackendSrv().fetch<CloudRulePreviewResponse>({
        method: 'POST',
        url: `/api/v1/rule/test/${dsSettings.uid}`,
        data: {
          expr: mapToValue(dataQuery),
        },
      })
    );
  }, [dsSettings, dataQuery]);

  const onRunQueriesClick = async () => {
    await fetchPreview();
  };

  if (loading || dataSource?.name !== dsSettings.name) {
    return null;
  }

  if (error || !dataSource || !dataSource?.components?.QueryEditor) {
    const errorMessage = error?.message || 'Data source plugin does not export any Query Editor component';
    return <div>Could not load query editor due to: {errorMessage}</div>;
  }

  const previewLoaded = !!previewState.value?.ok && !previewState.loading && !previewState.error;
  const previewInstances = previewState.value?.data?.instances ?? [];
  // The preview API returns arrays with empty elements when there are no firing alerts
  const previewHasAlerts = previewInstances.every((instance) =>
    instance?.data?.values.every((value) => value.length > 0)
  );

  const QueryEditor = dataSource?.components?.QueryEditor;

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
        <Button type="button" onClick={onRunQueriesClick} disabled={previewState.loading}>
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
        {previewHasAlerts &&
          previewInstances.map((frame, index) => {
            const fields: FieldSchema[] = frame.schema?.fields ?? [];
            const values: string[][] = frame.data?.values ?? [];

            const labelFields = fields.filter((field) => !['State', 'Info'].includes(field.name));
            const stateFieldIndex = fields.findIndex((field) => field.name === 'State');
            const infoFieldIndex = fields.findIndex((field) => field.name === 'Info');

            const labelIndexes = labelFields.map((labelField) => fields.indexOf(labelField));

            return (
              <table key={index} className={styles.table}>
                <thead>
                  <tr>
                    <th>State</th>
                    <th>Labels</th>
                    <th>Info</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: values[stateFieldIndex].length }, (v, i) => i).map((index) => {
                    const labelValues = labelIndexes.map((labelIndex) => [
                      fields[labelIndex].name,
                      values[labelIndex][index],
                    ]);
                    const state = values[stateFieldIndex][index];
                    const info = values[infoFieldIndex][index];

                    return (
                      <tr key={index}>
                        <td>{isGrafanaAlertState(state) && <AlertStateTag state={state} />}</td>
                        <td>
                          <TagList tags={labelValues.map(([key, value]) => `${key}=${value}`)} />
                        </td>
                        <td>
                          <Tooltip content={info}>
                            <Icon name="info-circle" />
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })}
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  table: css`
    width: 100%;

    td,
    th {
      padding: ${theme.spacing(1, 0)};
    }

    td + td,
    th + th {
      padding-left: ${theme.spacing(1)};
    }

    thead th:nth-child(1) {
      width: 80px;
    }

    thead th:nth-child(2) {
      width: auto;
    }

    thead th:nth-child(3) {
      width: 40px;
    }

    td:nth-child(3) {
      text-align: center;
    }

    tbody tr:nth-child(2n + 1) {
      background-color: ${theme.colors.background.secondary};
    }
  `,
  preview: css`
    padding: ${theme.spacing(2, 0)};
    max-width: ${theme.breakpoints.values.md}px;
  `,
  previewAlert: css`
    margin: ${theme.spacing(1, 0)};
  `,
  previewGrid: css`
    margin: ${theme.spacing(2, 0)};
    display: grid;
    gap: ${theme.spacing(2)};
    justify-content: flex-start;
    align-items: center;
    grid-template-columns: min-content 1fr min-content;
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

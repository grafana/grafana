import { css } from '@emotion/css';
import React, { useState } from 'react';

import {
  CoreApp,
  DataQuery,
  DataSourceApi,
  DataSourceInstanceSettings,
  getDefaultTimeRange,
  GrafanaTheme2,
  LoadingState,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors/src';
import { DataSourcePicker, getDataSourceSrv } from '@grafana/runtime';
import { Button, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { QueryEditorRows } from 'app/features/query/components/QueryEditorRows';

import { addQuery } from '../../../core/utils/query';
import { dataSource as expressionDatasource } from '../../expressions/ExpressionDatasource';
import { updateQueries } from '../../query/state/updateQueries';
import { isQueryWithMixedDatasource, SavedQuery } from '../api/SavedQueriesApi';
import { defaultQuery } from '../utils';

type Props = {
  savedQuery: SavedQuery;
  onSavedQueryChange: (newQuery: SavedQuery) => void;
};

export const QueryEditor = ({ savedQuery, onSavedQueryChange }: Props) => {
  const styles = useStyles2(getStyles);
  const [queries, setQueries] = useState<DataQuery[]>(savedQuery.queries ?? [defaultQuery]);

  const dsRef = isQueryWithMixedDatasource(savedQuery)
    ? { uid: '-- Mixed --', type: 'datasource' }
    : queries[0].datasource;

  const [dsSettings, setDsSettings] = useState(getDataSourceSrv().getInstanceSettings(dsRef));

  const data = {
    state: LoadingState.NotStarted,
    series: [],
    timeRange: getDefaultTimeRange(),
  };

  const onQueriesChange = (newQueries: DataQuery[]) => {
    setQueries(newQueries);
    onSavedQueryChange({
      ...savedQuery,
      queries: newQueries,
    });
  };

  const onDsChange = async (newDsSettings: DataSourceInstanceSettings) => {
    const newDs = await getDataSourceSrv().get(newDsSettings.uid);
    const currentDS = dsSettings ? await getDataSourceSrv().get(dsSettings.uid) : undefined;
    const newQueries = await updateQueries(newDs, newDs.uid, queries, currentDS);

    onQueriesChange(newQueries);
    setDsSettings(newDsSettings);
  };

  const newQuery = async (): Promise<Partial<DataQuery>> => {
    const ds: DataSourceApi = !dsSettings?.meta.mixed // TODO remove the asyncs and use prefetched ds apis
      ? await getDataSourceSrv().get(dsSettings!.uid)
      : await getDataSourceSrv().get();

    return {
      ...ds?.getDefaultQuery?.(CoreApp.PanelEditor),
      datasource: { uid: ds?.uid, type: ds?.type },
    };
  };

  const onAddQueryClick = async () => {
    const newQ = await newQuery();
    onQueriesChange(addQuery(queries, newQ));
  };

  const onAddExpressionClick = () => {
    const newExpr = expressionDatasource.newQuery();
    onQueriesChange(addQuery(queries, newExpr));
  };

  return (
    <div>
      <HorizontalGroup>
        <div className={styles.dataSourceHeader}>Data source</div>
        <div className={styles.dataSourcePickerWrapper}>
          <DataSourcePicker
            onChange={onDsChange}
            current={dsSettings}
            metrics={true}
            mixed={true}
            dashboard={true}
            variables={true}
          />
        </div>
      </HorizontalGroup>
      <QueryEditorRows
        queries={queries}
        dsSettings={dsSettings!}
        onQueriesChange={onQueriesChange}
        onAddQuery={onAddQueryClick}
        onRunQueries={() => {}}
        data={data}
      />
      <HorizontalGroup spacing="md" align="flex-start">
        {
          <Button
            disabled={false}
            icon="plus"
            onClick={onAddQueryClick}
            variant="secondary"
            aria-label={selectors.components.QueryTab.addQuery}
          >
            Query
          </Button>
        }
        {(dsSettings?.meta.alerting || dsSettings?.meta.mixed) && (
          <Button icon="plus" onClick={onAddExpressionClick} variant="secondary" className={styles.expressionButton}>
            <span>Expression&nbsp;</span>
          </Button>
        )}
      </HorizontalGroup>
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    dataSourceHeader: css`
      font-size: ${theme.typography.size.sm};
      margin-top: 5px;
      margin-bottom: 20px;
    `,
    dataSourcePickerWrapper: css`
      margin-top: 5px;
      margin-bottom: 20px;
    `,
    expressionButton: css`
      margin-right: ${theme.spacing(2)};
    `,
  };
};

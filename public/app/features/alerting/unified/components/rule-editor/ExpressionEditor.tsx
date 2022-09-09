import { noop } from 'lodash';
import React, { FC, useCallback, useMemo, useRef, useState } from 'react';
import { useAsync, useObservable } from 'react-use';

import { CoreApp, DataQuery, DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Button } from '@grafana/ui/src';
import { LokiQuery } from 'app/plugins/datasource/loki/types';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';

import { AlertingQueryRunner } from '../../state/AlertingQueryRunner';
import { dataQueryToAlertQuery } from '../../utils/query';
import { RuleViewerVisualization } from '../rule-viewer/RuleViewerVisualization';

export interface ExpressionEditorProps {
  value?: string;
  onChange: (value: string) => void;
  dsSettings: DataSourceInstanceSettings; // will be a prometheus or loki datasource
}

export const ExpressionEditor: FC<ExpressionEditorProps> = ({ value, onChange, dsSettings }) => {
  const queryRunner = useRef(new AlertingQueryRunner());

  const queryData = useObservable(queryRunner.current.get());

  const { mapToValue, mapToQuery } = useQueryMappers(dsSettings.name);
  const [dataQuery, setDataQuery] = useState(mapToQuery({ refId: 'A', hide: false }, value));
  const alertQuery = dataQueryToAlertQuery(dataQuery, dsSettings.uid);

  const {
    error,
    loading,
    value: dataSource,
  } = useAsync(() => {
    return getDataSourceSrv().get(dsSettings);
  }, [dsSettings]);

  const onChangeQuery = useCallback(
    (query: DataQuery) => {
      setDataQuery(query);
      onChange(mapToValue(query));
    },
    [onChange, mapToValue]
  );

  const onRunQueriesClick = async () => {
    await queryRunner.current.run([dataQueryToAlertQuery(dataQuery, dsSettings.uid)]);
  };

  if (loading || dataSource?.name !== dsSettings.name) {
    return null;
  }

  if (error || !dataSource || !dataSource?.components?.QueryEditor) {
    const errorMessage = error?.message || 'Data source plugin does not export any Query Editor component';
    return <div>Could not load query editor due to: {errorMessage}</div>;
  }

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
      <Button icon="sync" type="button" onClick={onRunQueriesClick}>
        Run queries
      </Button>

      <RuleViewerVisualization query={alertQuery} data={queryData && queryData[alertQuery.refId]} />
    </>
  );
};

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

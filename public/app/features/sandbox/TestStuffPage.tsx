import {
  ApplyFieldOverrideOptions,
  DataQuery,
  DataSourceSelectItem,
  DataTransformerConfig,
  dateMath,
  FieldColorModeId,
  PanelData,
} from '@grafana/data';
import { GraphNG, Table } from '@grafana/ui';
import { config } from 'app/core/config';
import React, { FC, useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import { QueryGroup } from '../query/components/QueryGroup';
import { QueryGroupOptions } from '../query/components/QueryGroupOptions';
import { PanelQueryRunner } from '../query/state/PanelQueryRunner';

interface State {
  queries: DataQuery[];
  queryRunner: PanelQueryRunner;
  dataSourceName: string | null;
  queryOptions: QueryGroupOptions;
  data?: PanelData;
}

export const TestStuffPage: FC = () => {
  const [state, setState] = useState<State>(getDefaultState());
  const { queryOptions, queryRunner, queries, dataSourceName } = state;

  const onDataSourceChange = (ds: DataSourceSelectItem, queries: DataQuery[]) => {
    setState({
      ...state,
      dataSourceName: ds.value,
      queries: queries,
    });
  };

  const onRunQueries = () => {
    const timeRange = { from: 'now-1h', to: 'now' };

    queryRunner.run({
      queries,
      timezone: 'browser',
      datasource: dataSourceName,
      timeRange: { from: dateMath.parse(timeRange.from)!, to: dateMath.parse(timeRange.to)!, raw: timeRange },
      maxDataPoints: queryOptions.maxDataPoints ?? 100,
      minInterval: queryOptions.minInterval,
    });
  };

  const onQueriesChange = (queries: DataQuery[]) => {
    setState({ ...state, queries: queries });
  };

  const onQueryOptionsChange = (queryOptions: QueryGroupOptions) => {
    setState({ ...state, queryOptions });
  };

  /**
   * Subscribe to data
   */
  const observable = useMemo(() => queryRunner.getData({ withFieldConfig: true, withTransforms: true }), []);
  const data = useObservable(observable);

  return (
    <div style={{ padding: '30px 50px' }} className="page-scrollbar-wrapper">
      <h3>New page</h3>
      <div>
        <QueryGroup
          options={queryOptions}
          dataSourceName={dataSourceName}
          queryRunner={queryRunner}
          queries={queries}
          onDataSourceChange={onDataSourceChange}
          onRunQueries={onRunQueries}
          onQueriesChange={onQueriesChange}
          onOptionsChange={onQueryOptionsChange}
        />
      </div>

      {data && (
        <div style={{ padding: '16px' }}>
          <GraphNG width={1200} height={300} data={data.series} timeRange={data.timeRange} timeZone="browser" />
          <hr></hr>
          <Table data={data.series[0]} width={1200} height={300} />
        </div>
      )}
    </div>
  );
};

export function getDefaultState(): State {
  const options: ApplyFieldOverrideOptions = {
    fieldConfig: {
      defaults: {
        color: {
          mode: FieldColorModeId.PaletteClassic,
        },
      },
      overrides: [],
    },
    replaceVariables: (v: string) => v,
    theme: config.theme,
  };

  const dataConfig = {
    getTransformations: () => [] as DataTransformerConfig[],
    getFieldOverrideOptions: () => options,
  };

  return {
    queries: [],
    dataSourceName: 'gdev-testdata',
    queryRunner: new PanelQueryRunner(dataConfig),
    queryOptions: {
      maxDataPoints: 100,
    },
  };
}

export default TestStuffPage;

import { ApplyFieldOverrideOptions, DataTransformerConfig, dateMath, FieldColorModeId, PanelData } from '@grafana/data';
import { Button, LegendDisplayMode, Table } from '@grafana/ui';
import { config } from 'app/core/config';
import React, { FC, useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import { QueryGroup } from '../query/components/QueryGroup';
import { PanelQueryRunner } from '../query/state/PanelQueryRunner';
import { QueryGroupOptions } from 'app/types';
import { PanelRenderer } from '../panel/PanelRenderer';
import { Options } from 'app/plugins/panel/timeseries/types';

interface State {
  queryRunner: PanelQueryRunner;
  queryOptions: QueryGroupOptions;
  data?: PanelData;
}

export const TestStuffPage: FC = () => {
  const [state, setState] = useState<State>(getDefaultState());
  const { queryOptions, queryRunner } = state;

  const onRunQueries = () => {
    const timeRange = { from: 'now-1h', to: 'now' };

    queryRunner.run({
      queries: queryOptions.queries,
      datasource: queryOptions.dataSource.name!,
      timezone: 'browser',
      timeRange: { from: dateMath.parse(timeRange.from)!, to: dateMath.parse(timeRange.to)!, raw: timeRange },
      maxDataPoints: queryOptions.maxDataPoints ?? 100,
      minInterval: queryOptions.minInterval,
    });
  };

  const onOptionsChange = (queryOptions: QueryGroupOptions) => {
    setState({ ...state, queryOptions });
  };

  /**
   * Subscribe to data
   */
  const observable = useMemo(() => queryRunner.getData({ withFieldConfig: false, withTransforms: false }), []);
  const data = useObservable(observable);
  const options: Options = {
    legend: {
      displayMode: LegendDisplayMode.List,
      placement: 'bottom',
      calcs: [],
    },
    graph: {},
    tooltipOptions: {
      mode: 'single',
    },
  };

  return (
    <div style={{ padding: '30px 50px' }} className="page-scrollbar-wrapper">
      <h3>New page</h3>
      <div>
        <Button onClick={onRunQueries}>RUN</Button>
        <QueryGroup
          options={queryOptions}
          queryRunner={queryRunner}
          onRunQueries={onRunQueries}
          onOptionsChange={onOptionsChange}
        />
      </div>

      {data && (
        <div style={{ padding: '16px' }}>
          <PanelRenderer<Options>
            title="test"
            onOptionsChange={() => {}}
            pluginId="timeseries"
            width={1200}
            height={300}
            data={data}
            options={options}
          />
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
    queryRunner: new PanelQueryRunner(dataConfig),
    queryOptions: {
      queries: [],
      dataSource: {
        name: 'gdev-testdata',
      },
      maxDataPoints: 100,
    },
  };
}

export default TestStuffPage;

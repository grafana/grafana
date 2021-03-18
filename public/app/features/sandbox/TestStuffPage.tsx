import { dateMath, PanelData } from '@grafana/data';
import { Button, GraphFieldConfig, LegendDisplayMode, Table } from '@grafana/ui';
import React, { FC, useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import { QueryGroup } from '../query/components/QueryGroup';
import { PanelQueryRunner } from '../query/state/PanelQueryRunner';
import { QueryGroupOptions } from 'app/types';
import { Options } from 'app/plugins/panel/timeseries/types';
import { QueryRunner } from '../query/state/QueryRunner';
import { PanelRenderer, PanelRendererType } from '@grafana/runtime';

const TypedPanelRenderer = PanelRenderer as PanelRendererType<Options, GraphFieldConfig>;
interface State {
  queryRunner: QueryRunner;
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
  const observable = useMemo(() => queryRunner.get(), []);
  const data = useObservable(observable);
  const pqr = useMemo(() => {
    const runner = new PanelQueryRunner({
      getFieldOverrideOptions: () => undefined,
      getTransformations: () => undefined,
    });
    runner.useLastResultFrom(new PQRAdapter(data));
    return runner;
  }, [data]);
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
          queryRunner={pqr}
          options={queryOptions}
          onRunQueries={onRunQueries}
          onOptionsChange={onOptionsChange}
        />
      </div>

      {data && (
        <div style={{ padding: '16px' }}>
          <TypedPanelRenderer
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
  return {
    queryRunner: new QueryRunner(),
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

class PQRAdapter extends PanelQueryRunner {
  constructor(private data: PanelData | undefined) {
    super({ getFieldOverrideOptions: () => undefined, getTransformations: () => undefined });
  }

  getLastResult() {
    return this.data;
  }
}

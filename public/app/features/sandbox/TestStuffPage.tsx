import { LegendDisplayMode } from '@grafana/schema';
import {
  ApplyFieldOverrideOptions,
  DataTransformerConfig,
  dateMath,
  FieldColorModeId,
  NavModelItem,
  PanelData,
} from '@grafana/data';
import { Table, TimeSeries } from '@grafana/ui';
import { config } from 'app/core/config';
import React, { FC, useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import { QueryGroup } from '../query/components/QueryGroup';
import { PanelQueryRunner } from '../query/state/PanelQueryRunner';
import { QueryGroupOptions } from 'app/types';
import Page from '../../core/components/Page/Page';
import AutoSizer from 'react-virtualized-auto-sizer';

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
  const observable = useMemo(() => queryRunner.getData({ withFieldConfig: true, withTransforms: true }), [queryRunner]);
  const data = useObservable(observable);

  const node: NavModelItem = {
    id: 'test-page',
    text: 'Test page',
    icon: 'dashboard',
    subTitle: 'FOR TESTING!',
    url: 'sandbox/test',
  };

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents>
        {data && (
          <AutoSizer style={{ width: '100%', height: '600px' }}>
            {({ width }) => {
              return (
                <div>
                  <TimeSeries
                    width={width}
                    height={300}
                    frames={data.series}
                    legend={{ displayMode: LegendDisplayMode.List, placement: 'bottom', calcs: [] }}
                    timeRange={data.timeRange}
                    timeZone="browser"
                  />
                  <Table data={data.series[0]} width={width} height={300} />
                </div>
              );
            }}
          </AutoSizer>
        )}
        <div style={{ marginTop: '16px', height: '45%' }}>
          <QueryGroup
            options={queryOptions}
            queryRunner={queryRunner}
            onRunQueries={onRunQueries}
            onOptionsChange={onOptionsChange}
          />
        </div>
      </Page.Contents>
    </Page>
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
    theme: config.theme2,
  };

  const dataConfig = {
    getTransformations: () => [] as DataTransformerConfig[],
    getFieldOverrideOptions: () => options,
    getDataSupport: () => ({ annotations: false, alertStates: false }),
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

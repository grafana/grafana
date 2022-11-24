/* eslint-disable jsx-a11y/heading-has-content */
import React, { useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  ApplyFieldOverrideOptions,
  DataFrame,
  DataTransformerConfig,
  dateMath,
  FieldColorModeId,
  NavModelItem,
  PanelData,
} from '@grafana/data';
import { SortOrder } from '@grafana/schema';
import { Button, Table } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { config } from 'app/core/config';
import { useAppNotification } from 'app/core/copy/appNotification';
import { QueryGroupOptions } from 'app/types';

import { PanelRenderer } from '../panel/components/PanelRenderer';
import { QueryGroup } from '../query/components/QueryGroup';
import { PanelQueryRunner } from '../query/state/PanelQueryRunner';

interface State {
  queryRunner: PanelQueryRunner;
  queryOptions: QueryGroupOptions;
  data?: PanelData;
}

export const TestStuffPage = () => {
  const [state, setState] = useState<State>(getDefaultState());
  const { queryOptions, queryRunner } = state;

  const onRunQueries = () => {
    const timeRange = { from: 'now-1h', to: 'now' };

    queryRunner.run({
      queries: queryOptions.queries,
      datasource: queryOptions.dataSource,
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

  const notifyApp = useAppNotification();

  const customJSX = (data: DataFrame, rowIndex?: number, columnIndex?: number) => {
    if (!data || rowIndex == null) {
      return null;
    }

    const date = data.fields[0].values.get(rowIndex);
    const hour = data.fields[1].values.get(rowIndex);
    const value = data.fields[2].values.get(rowIndex);
    const status = data.fields[3].values.get(rowIndex);

    let statusColor = '';
    switch (status) {
      case 'FINISHED':
        statusColor = 'green';
        break;
      case 'FAILED':
        statusColor = 'red';
        break;
      case 'RUNNING':
        statusColor = 'yellow';
        break;
    }

    return (
      <>
        <div style={{ width: '100%', backgroundColor: statusColor, textAlign: 'center' }}>
          <h2>{status}</h2>
        </div>
        <h1 style={{ textAlign: 'center' }}>{value} ms</h1>
        <h2 style={{ textAlign: 'center' }}>
          {date} at {hour}
        </h2>
      </>
    );
  };

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents>
        {data && (
          <AutoSizer style={{ width: '100%', height: '600px' }}>
            {({ width }) => {
              return (
                <div>
                  <PanelRenderer
                    title="Hello"
                    pluginId="barchart"
                    width={width}
                    height={300}
                    data={data}
                    options={{ customTooltipJSX: customJSX }}
                    fieldConfig={{ defaults: {}, overrides: [] }}
                    timeZone="browser"
                  />
                  {data.series[0] && <Table data={data.series[0]} width={width} height={300} />}
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
        <div style={{ display: 'flex', gap: '1em' }}>
          <Button onClick={() => notifyApp.success('Success toast', 'some more text goes here')} variant="primary">
            Success
          </Button>
          <Button
            onClick={() => notifyApp.warning('Warning toast', 'some more text goes here', 'bogus-trace-99999')}
            variant="secondary"
          >
            Warning
          </Button>
          <Button
            onClick={() => notifyApp.error('Error toast', 'some more text goes here', 'bogus-trace-fdsfdfsfds')}
            variant="destructive"
          >
            Error
          </Button>
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

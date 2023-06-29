import React, { useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  ApplyFieldOverrideOptions,
  DataFrame,
  dateMath,
  FieldColorModeId,
  FieldType,
  NavModelItem,
  PanelData,
  toDataFrame,
} from '@grafana/data';
import { getPluginExtensions, isPluginExtensionLink } from '@grafana/runtime';
import { DataTransformerConfig } from '@grafana/schema';
import { Button, HorizontalGroup, LinkButton, Table } from '@grafana/ui';
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

  const dataFrame = toDataFrame({
    name: 'A',
    fields: [
      {
        name: 'time',
        type: FieldType.time,
        values: [1609459200000, 1609470000000, 1609462800000, 1609466400000],
        config: {
          custom: {
            filterable: false,
          },
        },
      },
      {
        name: 'temperature',
        type: FieldType.number,
        values: [10, null, 11, 12],
        config: {
          custom: {
            filterable: false,
          },
          links: [
            {
              targetBlank: true,
              title: 'Value link',
              url: '${__value.text}',
            },
          ],
        },
      },
      {
        name: 'img',
        type: FieldType.string,
        values: ['data:image/png;base64,1', 'data:image/png;base64,2', 'data:image/png;base64,3'],
        config: {
          custom: {
            filterable: false,
            displayMode: 'image',
          },
          links: [
            {
              targetBlank: true,
              title: 'Image link',
              url: '${__value.text}',
            },
          ],
        },
      },
    ],
  });

  const dataFrameChild = toDataFrame({
    name: 'A',
    meta: {
      custom: {
        parentRowIndex: 0,
      },
    },
    fields: [
      {
        name: 'time_child',
        type: FieldType.time,
        values: [1609459200000, 1609470000000, 1609462800000, 1609466400000],
        config: {
          custom: {
            filterable: false,
          },
        },
      },
      {
        name: 'child_test_values',
        type: FieldType.number,
        values: [1, 2, 3, 4],
        config: {},
      },
    ],
  });

  const dataFrameChild2 = toDataFrame({
    name: 'A',
    meta: {
      custom: {
        parentRowIndex: 2,
      },
    },
    fields: [
      {
        name: 'time_child2',
        type: FieldType.time,
        values: [1609459200000, 1609470000000, 1609462800000],
        config: {
          custom: {
            filterable: false,
          },
        },
      },
      {
        name: 'child_test_values2',
        type: FieldType.number,
        values: [6, 7, 8],
        config: {},
      },
    ],
  });

  const dataFrameChildEmpty = toDataFrame({
    name: 'A',
    meta: {
      custom: {
        parentRowIndex: 1,
      },
    },
    fields: [
      {
        name: 'time_child2',
        type: FieldType.time,
        values: [],
        config: {
          custom: {
            filterable: false,
          },
        },
      },
      {
        name: 'child_test_values2',
        type: FieldType.number,
        values: [],
        config: {},
      },
    ],
  });

  const pd: PanelData = { ...data!, series: [dataFrame, dataFrameChild, dataFrameChild2, dataFrameChildEmpty] };

  const notifyApp = useAppNotification();

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents>
        {/* <HorizontalGroup>
          <LinkToBasicApp extensionPointId="grafana/sandbox/testing" />
  </HorizontalGroup> */}
        {data && (
          <AutoSizer style={{ width: '100%', height: '600px' }}>
            {({ width }) => {
              return (
                <div>
                  <PanelRenderer
                    title="Hello"
                    pluginId="table"
                    width={width}
                    height={300}
                    data={pd}
                    options={{}}
                    fieldConfig={{ defaults: {}, overrides: [] }}
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

function LinkToBasicApp({ extensionPointId }: { extensionPointId: string }) {
  const { extensions } = getPluginExtensions({ extensionPointId });

  if (extensions.length === 0) {
    return null;
  }

  return (
    <div>
      {extensions.map((extension, i) => {
        if (!isPluginExtensionLink(extension)) {
          return null;
        }
        return (
          <LinkButton href={extension.path} title={extension.description} key={extension.id}>
            {extension.title}
          </LinkButton>
        );
      })}
    </div>
  );
}

export default TestStuffPage;

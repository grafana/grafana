import React, { useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  ApplyFieldOverrideOptions,
  arrayUtils,
  DataFrame,
  DataTransformerConfig,
  dateMath,
  Field,
  FieldColorModeId,
  formattedValueToString,
  getFieldDisplayName,
  LinkModel,
  NavModelItem,
  PanelData,
} from '@grafana/data';
import { Button, LinkButton, SortOrder, Table, TooltipDisplayMode, VerticalGroup } from '@grafana/ui';
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

  const tooltipFn = (
    data: DataFrame,
    rowIndex: number,
    columnIndex: number,
    sortOrder: SortOrder,
    mode: TooltipDisplayMode
  ) => {
    if (!data || rowIndex == null) {
      return null;
    }

    const visibleFields = data.fields.filter((f) => !Boolean(f.config.custom?.hideFrom?.tooltip));

    if (visibleFields.length === 0) {
      return null;
    }

    const displayValues: Array<[string, unknown, string]> = [];
    const links: Array<LinkModel<Field>> = [];
    const linkLookup = new Set<string>();

    for (const f of visibleFields) {
      const v = f.values.get(rowIndex);
      const disp = f.display ? f.display(v) : { text: `${v}`, numeric: +v };
      if (f.getLinks) {
        f.getLinks({ calculatedValue: disp, valueRowIndex: rowIndex }).forEach((link) => {
          const key = `${link.title}/${link.href}`;
          if (!linkLookup.has(key)) {
            links.push(link);
            linkLookup.add(key);
          }
        });
      }

      displayValues.push([getFieldDisplayName(f, data), v, formattedValueToString(disp)]);
    }

    if (sortOrder && sortOrder !== SortOrder.None) {
      displayValues.sort((a, b) => arrayUtils.sortValues(sortOrder)(a[1], b[1]));
    }

    return (
      <>
        <h2>CUSTOM TOOLTIP</h2>
        <table>
          <tbody>
            {(mode === TooltipDisplayMode.Multi || mode == null) &&
              displayValues.map((v, i) => (
                <tr key={`${i}/${rowIndex}`}>
                  <th>{v[0]}:</th>
                  <td>{v[2]}</td>
                </tr>
              ))}
            {mode === TooltipDisplayMode.Single && columnIndex && (
              <tr key={`${columnIndex}/${rowIndex}`}>
                <th>{displayValues[columnIndex][0]}:</th>
                <td>{displayValues[columnIndex][2]}</td>
              </tr>
            )}
            {links.length > 0 && (
              <tr>
                <td colSpan={2}>
                  <VerticalGroup>
                    {links.map((link, i) => (
                      <LinkButton
                        key={i}
                        icon={'external-link-alt'}
                        target={link.target}
                        href={link.href}
                        onClick={link.onClick}
                        fill="text"
                        style={{ width: '100%' }}
                      >
                        {link.title}
                      </LinkButton>
                    ))}
                  </VerticalGroup>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </>
    );
  }

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents>
        {data && (
          <AutoSizer style={{ width: '100%', height: '900px' }}>
            {({ width }) => {
              return (
                <div>
                  <PanelRenderer
                    title="Hello"
                    pluginId="timeseries"
                    width={width}
                    height={300}
                    data={data}
                    options={{}}
                    fieldConfig={{ defaults: {}, overrides: [] }}
                    timeZone="browser"
                  />
                  <Table data={data.series[0]} width={width} height={300} />
                  <PanelRenderer
                    pluginId="barchart"
                    title="Hello"
                    width={width}
                    height={300}
                    data={data}
                    options={{}}
                    fieldConfig={{ defaults: {}, overrides: [] }}
                    timeZone="browser"
                    extraProps={{ tooltipFn }}
                  />
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

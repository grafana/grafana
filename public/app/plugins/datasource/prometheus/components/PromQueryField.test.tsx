// @ts-ignore
import RCCascader from 'rc-cascader';
import React from 'react';
import PromQlLanguageProvider, { DEFAULT_LOOKUP_METRICS_THRESHOLD } from '../language_provider';
import PromQueryField, { groupMetricsByPrefix, RECORDING_RULES_GROUP } from './PromQueryField';
import { DataSourceInstanceSettings, dateTime } from '@grafana/data';
import { PromOptions } from '../types';
import { fireEvent, render, screen } from '@testing-library/react';

describe('PromQueryField', () => {
  beforeAll(() => {
    // @ts-ignore
    window.getSelection = () => {};
  });

  it('renders metrics chooser regularly if lookups are not disabled in the datasource settings', () => {
    const datasource = ({
      languageProvider: {
        start: () => Promise.resolve([]),
      },
    } as unknown) as DataSourceInstanceSettings<PromOptions>;

    const queryField = render(
      <PromQueryField
        // @ts-ignore
        datasource={datasource}
        query={{ expr: '', refId: '' }}
        onRunQuery={() => {}}
        onChange={() => {}}
        history={[]}
      />
    );

    expect(queryField.getAllByRole('button')).toHaveLength(1);
  });

  it('renders a disabled metrics chooser if lookups are disabled in datasource settings', () => {
    const queryField = render(
      <PromQueryField
        // @ts-ignore
        datasource={{ lookupsDisabled: true }}
        query={{ expr: '', refId: '' }}
        onRunQuery={() => {}}
        onChange={() => {}}
        history={[]}
      />
    );

    const bcButton = queryField.getByRole('button');
    expect(bcButton).toBeDisabled();
  });

  it('refreshes metrics when the data source changes', async () => {
    const defaultProps = {
      query: { expr: '', refId: '' },
      onRunQuery: () => {},
      onChange: () => {},
      history: [],
    };
    const metrics = ['foo', 'bar'];
    const queryField = render(
      <PromQueryField
        // @ts-ignore
        datasource={{
          languageProvider: makeLanguageProvider({ metrics: [metrics] }),
        }}
        {...defaultProps}
      />
    );

    checkMetricsInCascader(await screen.findByRole('button'), metrics);

    const changedMetrics = ['baz', 'moo'];
    queryField.rerender(
      <PromQueryField
        // @ts-ignore
        datasource={{
          languageProvider: makeLanguageProvider({ metrics: [changedMetrics] }),
        }}
        {...defaultProps}
      />
    );

    // If we check the cascader right away it should be in loading state
    let cascader = screen.getByRole('button');
    expect(cascader.textContent).toContain('Loading');
    checkMetricsInCascader(await screen.findByRole('button'), changedMetrics);
  });

  it('refreshes metrics when time range changes but dont show loading state', async () => {
    const defaultProps = {
      query: { expr: '', refId: '' },
      onRunQuery: () => {},
      onChange: () => {},
      history: [],
    };
    const metrics = ['foo', 'bar'];
    const changedMetrics = ['baz', 'moo'];
    const range = {
      from: dateTime('2020-10-28T00:00:00Z'),
      to: dateTime('2020-10-28T01:00:00Z'),
    };

    const languageProvider = makeLanguageProvider({ metrics: [metrics, changedMetrics] });
    const queryField = render(
      <PromQueryField
        // @ts-ignore
        datasource={{ languageProvider }}
        range={{
          ...range,
          raw: range,
        }}
        {...defaultProps}
      />
    );
    checkMetricsInCascader(await screen.findByRole('button'), metrics);

    const newRange = {
      from: dateTime('2020-10-28T01:00:00Z'),
      to: dateTime('2020-10-28T02:00:00Z'),
    };
    queryField.rerender(
      <PromQueryField
        // @ts-ignore
        datasource={{ languageProvider }}
        range={{
          ...newRange,
          raw: newRange,
        }}
        {...defaultProps}
      />
    );
    let cascader = screen.getByRole('button');
    // Should not show loading
    expect(cascader.textContent).toContain('Metrics');
    checkMetricsInCascader(cascader, metrics);
  });
});

describe('groupMetricsByPrefix()', () => {
  it('returns an empty group for no metrics', () => {
    expect(groupMetricsByPrefix([])).toEqual([]);
  });

  it('returns options grouped by prefix', () => {
    expect(groupMetricsByPrefix(['foo_metric'])).toMatchObject([
      {
        value: 'foo',
        children: [
          {
            value: 'foo_metric',
          },
        ],
      },
    ]);
  });

  it('returns options grouped by prefix with metadata', () => {
    expect(groupMetricsByPrefix(['foo_metric'], { foo_metric: [{ type: 'TYPE', help: 'my help' }] })).toMatchObject([
      {
        value: 'foo',
        children: [
          {
            value: 'foo_metric',
            title: 'foo_metric\nTYPE\nmy help',
          },
        ],
      },
    ]);
  });

  it('returns options without prefix as toplevel option', () => {
    expect(groupMetricsByPrefix(['metric'])).toMatchObject([
      {
        value: 'metric',
      },
    ]);
  });

  it('returns recording rules grouped separately', () => {
    expect(groupMetricsByPrefix([':foo_metric:'])).toMatchObject([
      {
        value: RECORDING_RULES_GROUP,
        children: [
          {
            value: ':foo_metric:',
          },
        ],
      },
    ]);
  });
});

function makeLanguageProvider(options: { metrics: string[][] }) {
  const metricsStack = [...options.metrics];
  return ({
    histogramMetrics: [] as any,
    metrics: [],
    metricsMetadata: {},
    lookupsDisabled: false,
    lookupMetricsThreshold: DEFAULT_LOOKUP_METRICS_THRESHOLD,
    start() {
      this.metrics = metricsStack.shift();
      return Promise.resolve([]);
    },
  } as any) as PromQlLanguageProvider;
}

function checkMetricsInCascader(cascader: HTMLElement, metrics: string[]) {
  fireEvent.keyDown(cascader, { keyCode: 40 });
  let listNodes = screen.getAllByRole('menuitem');
  for (const node of listNodes) {
    expect(metrics).toContain(node.innerHTML);
  }
}

// @ts-ignore
import RCCascader from 'rc-cascader';
import React from 'react';
import PromQlLanguageProvider from '../language_provider';
import PromQueryField from './PromQueryField';
import { DataSourceInstanceSettings, dateTime } from '@grafana/data';
import { PromOptions } from '../types';
import { render, screen } from '@testing-library/react';

describe('PromQueryField', () => {
  beforeAll(() => {
    // @ts-ignore
    window.getSelection = () => {};
  });

  it('renders metrics chooser regularly if lookups are not disabled in the datasource settings', () => {
    const datasource = ({
      languageProvider: {
        start: () => Promise.resolve([]),
        syntax: () => {},
        getLabelKeys: () => [],
        metrics: [],
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
    const datasource = ({
      languageProvider: {
        start: () => Promise.resolve([]),
        syntax: () => {},
        getLabelKeys: () => [],
        metrics: [],
      },
    } as unknown) as DataSourceInstanceSettings<PromOptions>;
    const queryField = render(
      <PromQueryField
        // @ts-ignore
        datasource={{ ...datasource, lookupsDisabled: true }}
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

    // If we check the label browser right away it should be in loading state
    let labelBrowser = screen.getByRole('button');
    expect(labelBrowser.textContent).toContain('Loading');
  });

  it.skip('does not refreshes metrics when after rounding to minute time range does not change', async () => {
    const defaultProps = {
      query: { expr: '', refId: '' },
      onRunQuery: () => {},
      onChange: () => {},
      history: [],
    };
    const metrics = ['foo', 'bar'];
    const changedMetrics = ['foo', 'baz'];
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

    const newRange = {
      from: dateTime('2020-10-28T00:00:01Z'),
      to: dateTime('2020-10-28T01:00:01Z'),
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
  });

  it.skip('refreshes metrics when time range changes but dont show loading state', async () => {
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
  });
});

function makeLanguageProvider(options: { metrics: string[][] }) {
  const metricsStack = [...options.metrics];
  return ({
    histogramMetrics: [] as any,
    metrics: [],
    metricsMetadata: {},
    lookupsDisabled: false,
    getLabelKeys: () => [],
    start() {
      this.metrics = metricsStack.shift();
      return Promise.resolve([]);
    },
  } as any) as PromQlLanguageProvider;
}

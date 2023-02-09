import { getByTestId, render, screen } from '@testing-library/react';
// @ts-ignore
import userEvent from '@testing-library/user-event';
import React from 'react';

import { PanelData, LoadingState, DataFrame, CoreApp } from '@grafana/data';

import { PrometheusDatasource } from '../datasource';
import PromQlLanguageProvider from '../language_provider';

import PromQueryField from './PromQueryField';
import { Props } from './monaco-query-field/MonacoQueryFieldProps';

// the monaco-based editor uses lazy-loading and that does not work
// well with this test, and we do not need the monaco-related
// functionality in this test anyway, so we mock it out.
jest.mock('./monaco-query-field/MonacoQueryFieldLazy', () => {
  const fakeQueryField = (props: Props) => {
    return <input onBlur={(e) => props.onBlur(e.currentTarget.value)} data-testid={'dummy-code-input'} type={'text'} />;
  };
  return {
    MonacoQueryFieldLazy: fakeQueryField,
  };
});

const defaultProps = {
  datasource: {
    languageProvider: {
      start: () => Promise.resolve([]),
      syntax: () => {},
      getLabelKeys: () => [],
      metrics: [],
    },
    getInitHints: () => [],
  } as unknown as PrometheusDatasource,
  query: {
    expr: '',
    refId: '',
  },
  onRunQuery: () => {},
  onChange: () => {},
  history: [],
};

describe('PromQueryField', () => {
  beforeAll(() => {
    // @ts-ignore
    window.getSelection = () => {};
  });

  it('renders metrics chooser regularly if lookups are not disabled in the datasource settings', () => {
    const queryField = render(<PromQueryField {...defaultProps} />);

    expect(queryField.getAllByRole('button')).toHaveLength(1);
  });

  it('renders a disabled metrics chooser if lookups are disabled in datasource settings', () => {
    const props = defaultProps;
    props.datasource.lookupsDisabled = true;
    const queryField = render(<PromQueryField {...props} />);

    const bcButton = queryField.getByRole('button');
    expect(bcButton).toBeDisabled();
  });

  it('renders an initial hint if no data and initial hint provided', () => {
    const props = defaultProps;
    props.datasource.lookupsDisabled = true;
    props.datasource.getInitHints = () => [{ label: 'Initial hint', type: 'INFO' }];
    render(<PromQueryField {...props} />);

    expect(screen.getByText('Initial hint')).toBeInTheDocument();
  });

  it('renders query hint if data, query hint and initial hint provided', () => {
    const props = defaultProps;
    props.datasource.lookupsDisabled = true;
    props.datasource.getInitHints = () => [{ label: 'Initial hint', type: 'INFO' }];
    props.datasource.getQueryHints = () => [{ label: 'Query hint', type: 'INFO' }];
    render(
      <PromQueryField
        {...props}
        data={
          {
            series: [{ name: 'test name' }] as DataFrame[],
            state: LoadingState.Done,
          } as PanelData
        }
      />
    );

    expect(screen.getByText('Query hint')).toBeInTheDocument();
    expect(screen.queryByText('Initial hint')).not.toBeInTheDocument();
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
        datasource={
          {
            languageProvider: makeLanguageProvider({ metrics: [metrics] }),
            getInitHints: () => [],
          } as unknown as PrometheusDatasource
        }
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

  it('should not run query onBlur in explore', async () => {
    const onRunQuery = jest.fn();
    const { container } = render(<PromQueryField {...defaultProps} app={CoreApp.Explore} onRunQuery={onRunQuery} />);

    const input = getByTestId(container, 'dummy-code-input');
    expect(input).toBeInTheDocument();
    await userEvent.type(input, 'metric');
    input.blur();
    expect(onRunQuery).not.toHaveBeenCalled();
  });

  it('should run query onBlur in dashboard', async () => {
    const onRunQuery = jest.fn();
    const { container } = render(<PromQueryField {...defaultProps} app={CoreApp.Dashboard} onRunQuery={onRunQuery} />);

    const input = getByTestId(container, 'dummy-code-input');
    expect(input).toBeInTheDocument();
    await userEvent.type(input, 'metric');
    input.blur();
    expect(onRunQuery).toHaveBeenCalled();
  });
});

function makeLanguageProvider(options: { metrics: string[][] }) {
  const metricsStack = [...options.metrics];
  return {
    histogramMetrics: [],
    metrics: [],
    metricsMetadata: {},
    lookupsDisabled: false,
    getLabelKeys: () => [],
    start() {
      this.metrics = metricsStack.shift();
      return Promise.resolve([]);
    },
  } as any as PromQlLanguageProvider;
}

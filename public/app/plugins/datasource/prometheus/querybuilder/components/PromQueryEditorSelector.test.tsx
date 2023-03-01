import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cloneDeep, defaultsDeep } from 'lodash';
import React from 'react';

import { CoreApp, PluginMeta, PluginType } from '@grafana/data';

import { PromQueryEditorProps } from '../../components/types';
import { PrometheusDatasource } from '../../datasource';
import PromQlLanguageProvider from '../../language_provider';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';
import { PromQuery } from '../../types';
import { QueryEditorMode } from '../shared/types';

import { EXPLAIN_LABEL_FILTER_CONTENT } from './PromQueryBuilderExplained';
import { PromQueryEditorSelector } from './PromQueryEditorSelector';

// We need to mock this because it seems jest has problem importing monaco in tests
jest.mock('../../components/monaco-query-field/MonacoQueryFieldWrapper', () => {
  return {
    MonacoQueryFieldWrapper: () => {
      return 'MonacoQueryFieldWrapper';
    },
  };
});

jest.mock('app/core/store', () => {
  return {
    get() {
      return undefined;
    },
    set() {},
    getObject(key: string, defaultValue: unknown) {
      return defaultValue;
    },
  };
});

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
  };
});

const defaultQuery = {
  refId: 'A',
  expr: 'metric{label1="foo", label2="bar"}',
};

const defaultMeta: PluginMeta = {
  id: '',
  name: '',
  type: PluginType.datasource,
  info: {
    author: {
      name: 'tester',
    },
    description: 'testing',
    links: [],
    logos: {
      large: '',
      small: '',
    },
    screenshots: [],
    updated: '',
    version: '',
  },
  module: '',
  baseUrl: '',
};

const getDefaultDatasource = (jsonDataOverrides = {}) =>
  new PrometheusDatasource(
    {
      id: 1,
      uid: '',
      type: 'prometheus',
      name: 'prom-test',
      access: 'proxy',
      url: '',
      jsonData: jsonDataOverrides,
      meta: defaultMeta,
      readOnly: false,
    },
    undefined,
    undefined,
    new EmptyLanguageProviderMock() as unknown as PromQlLanguageProvider
  );

const defaultProps = {
  datasource: getDefaultDatasource(),
  query: defaultQuery,
  onRunQuery: () => {},
  onChange: () => {},
};

describe('PromQueryEditorSelector', () => {
  it('shows code editor if expr and nothing else', async () => {
    // We opt for showing code editor for queries created before this feature was added
    render(<PromQueryEditorSelector {...defaultProps} />);
    expectCodeEditor();
  });

  it('shows code editor if no expr and nothing else since defaultEditor is code', async () => {
    renderWithDatasourceDefaultEditorMode(QueryEditorMode.Code);
    expectCodeEditor();
  });

  it('shows builder if no expr and nothing else since defaultEditor is builder', async () => {
    renderWithDatasourceDefaultEditorMode(QueryEditorMode.Builder);
    expectBuilder();
  });

  it('shows code editor when code mode is set', async () => {
    renderWithMode(QueryEditorMode.Code);
    expectCodeEditor();
  });

  it('shows builder when builder mode is set', () => {
    renderWithMode(QueryEditorMode.Builder);
    expectBuilder();
  });

  it('shows Run Queries button in Dashboards', () => {
    renderWithProps({}, { app: CoreApp.Dashboard });
    expectRunQueriesButton();
  });

  it('hides Run Queries button in Explore', () => {
    renderWithProps({}, { app: CoreApp.Explore });
    expectNoRunQueriesButton();
  });

  it('hides Run Queries button in Correlations Page', () => {
    renderWithProps({}, { app: CoreApp.Correlations });
    expectNoRunQueriesButton();
  });

  it('changes to builder mode', async () => {
    const { onChange } = renderWithMode(QueryEditorMode.Code);
    await switchToMode(QueryEditorMode.Builder);
    expect(onChange).toBeCalledWith({
      refId: 'A',
      expr: defaultQuery.expr,
      range: true,
      editorMode: QueryEditorMode.Builder,
    });
  });

  it('Should show raw query', async () => {
    renderWithProps({
      editorMode: QueryEditorMode.Builder,
      expr: 'my_metric',
    });
    expect(screen.getByLabelText('selector').textContent).toBe('my_metric');
  });

  it('Can enable explain', async () => {
    renderWithMode(QueryEditorMode.Builder);
    expect(screen.queryByText(EXPLAIN_LABEL_FILTER_CONTENT)).not.toBeInTheDocument();
    screen.getByLabelText('Explain').click();
    expect(await screen.findByText(EXPLAIN_LABEL_FILTER_CONTENT)).toBeInTheDocument();
  });

  it('changes to code mode', async () => {
    const { onChange } = renderWithMode(QueryEditorMode.Builder);
    await switchToMode(QueryEditorMode.Code);
    expect(onChange).toBeCalledWith({
      refId: 'A',
      expr: defaultQuery.expr,
      range: true,
      editorMode: QueryEditorMode.Code,
    });
  });

  it('parses query when changing to builder mode', async () => {
    const { rerender } = renderWithProps({
      refId: 'A',
      expr: 'rate(test_metric{instance="host.docker.internal:3000"}[$__interval])',
      editorMode: QueryEditorMode.Code,
    });
    await switchToMode(QueryEditorMode.Builder);
    rerender(
      <PromQueryEditorSelector
        {...defaultProps}
        query={{
          refId: 'A',
          expr: 'rate(test_metric{instance="host.docker.internal:3000"}[$__interval])',
          editorMode: QueryEditorMode.Builder,
        }}
      />
    );

    await screen.findByText('test_metric');
    expect(screen.getByText('host.docker.internal:3000')).toBeInTheDocument();
    expect(screen.getByText('Rate')).toBeInTheDocument();
    expect(screen.getByText('$__interval')).toBeInTheDocument();
  });
});

function renderWithMode(mode: QueryEditorMode) {
  return renderWithProps({ editorMode: mode });
}

function renderWithDatasourceDefaultEditorMode(mode: QueryEditorMode) {
  const props = {
    ...defaultProps,
    datasource: getDefaultDatasource({
      defaultEditor: mode,
    }),
    query: {
      refId: 'B',
      expr: '',
    },
    onRunQuery: () => {},
    onChange: () => {},
  };
  render(<PromQueryEditorSelector {...props} />);
}

function renderWithProps(overrides?: Partial<PromQuery>, componentProps: Partial<PromQueryEditorProps> = {}) {
  const query = defaultsDeep(overrides ?? {}, cloneDeep(defaultQuery));
  const onChange = jest.fn();

  const allProps = { ...defaultProps, ...componentProps };
  const stuff = render(<PromQueryEditorSelector {...allProps} query={query} onChange={onChange} />);
  return { onChange, ...stuff };
}

function expectCodeEditor() {
  expect(screen.getByText('MonacoQueryFieldWrapper')).toBeInTheDocument();
}

function expectBuilder() {
  expect(screen.getByText('Metric')).toBeInTheDocument();
}

function expectRunQueriesButton() {
  expect(screen.getByRole('button', { name: /run queries/i })).toBeInTheDocument();
}

function expectNoRunQueriesButton() {
  expect(screen.queryByRole('button', { name: /run queries/i })).not.toBeInTheDocument();
}
async function switchToMode(mode: QueryEditorMode) {
  const label = {
    [QueryEditorMode.Code]: /Code/,
    [QueryEditorMode.Builder]: /Builder/,
  }[mode];

  const switchEl = screen.getByLabelText(label);
  await userEvent.click(switchEl);
}

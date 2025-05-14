// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/PromQueryEditorSelector.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cloneDeep, defaultsDeep } from 'lodash';

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
    await expectCodeEditor();
  });

  it('shows code editor if no expr and nothing else since defaultEditor is code', async () => {
    renderWithDatasourceDefaultEditorMode(QueryEditorMode.Code);
    await expectCodeEditor();
  });

  it('shows builder if no expr and nothing else since defaultEditor is builder', async () => {
    renderWithDatasourceDefaultEditorMode(QueryEditorMode.Builder);
    await expectBuilder();
  });

  it('shows code editor when code mode is set', async () => {
    renderWithMode(QueryEditorMode.Code);
    await expectCodeEditor();
  });

  it('shows builder when builder mode is set', async () => {
    renderWithMode(QueryEditorMode.Builder);
    await expectBuilder();
  });

  it('shows Run Queries button in Dashboards', async () => {
    renderWithProps({}, { app: CoreApp.Dashboard });
    await expectRunQueriesButton();
  });

  it('hides Run Queries button in Explore', async () => {
    renderWithProps({}, { app: CoreApp.Explore });
    await expectCodeEditor();
    expectNoRunQueriesButton();
  });

  it('hides Run Queries button in Correlations Page', async () => {
    renderWithProps({}, { app: CoreApp.Correlations });
    await expectCodeEditor();
    expectNoRunQueriesButton();
  });

  it('changes to builder mode', async () => {
    const { onChange } = renderWithMode(QueryEditorMode.Code);
    await switchToMode(QueryEditorMode.Builder);
    expect(onChange).toHaveBeenCalledWith({
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
    await userEvent.click(screen.getByLabelText('Explain'));
    expect(await screen.findByText(EXPLAIN_LABEL_FILTER_CONTENT)).toBeInTheDocument();
  });

  it('changes to code mode', async () => {
    const { onChange } = renderWithMode(QueryEditorMode.Builder);
    await switchToMode(QueryEditorMode.Code);
    expect(onChange).toHaveBeenCalledWith({
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

    await screen.queryAllByText('test_metric');
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

async function expectCodeEditor() {
  expect(await screen.findByText('MonacoQueryFieldWrapper')).toBeInTheDocument();
}

async function expectBuilder() {
  expect(await screen.findByText('Metric')).toBeInTheDocument();
}

async function expectRunQueriesButton() {
  expect(await screen.findByRole('button', { name: /run queries/i })).toBeInTheDocument();
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

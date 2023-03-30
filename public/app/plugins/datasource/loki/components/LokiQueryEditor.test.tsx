import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cloneDeep, defaultsDeep } from 'lodash';
import React from 'react';

import { CoreApp } from '@grafana/data';
import { QueryEditorMode } from 'app/plugins/datasource/prometheus/querybuilder/shared/types';

import { createLokiDatasource } from '../mocks';
import { EXPLAIN_LABEL_FILTER_CONTENT } from '../querybuilder/components/LokiQueryBuilderExplained';
import { LokiQuery, LokiQueryType } from '../types';

import { LokiQueryEditor } from './LokiQueryEditor';
import { LokiQueryEditorProps } from './types';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
  };
});

// We need to mock this because it seems jest has problem importing monaco in tests
jest.mock('./monaco-query-field/MonacoQueryFieldWrapper', () => {
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

const defaultQuery = {
  refId: 'A',
  expr: '{label1="foo", label2="bar"}',
};

const datasource = createLokiDatasource();

jest.spyOn(datasource.languageProvider, 'fetchLabels').mockResolvedValue([]);
jest.spyOn(datasource, 'getDataSamples').mockResolvedValue([]);

const defaultProps = {
  datasource,
  query: defaultQuery,
  onRunQuery: () => {},
  onChange: () => {},
};

describe('LokiQueryEditorSelector', () => {
  it('shows code editor if expr and nothing else', async () => {
    // We opt for showing code editor for queries created before this feature was added
    render(<LokiQueryEditor {...defaultProps} />);
    await expectCodeEditor();
  });

  it('shows builder if new query', async () => {
    render(
      <LokiQueryEditor
        {...defaultProps}
        query={{
          refId: 'A',
          expr: '',
        }}
      />
    );
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
    await expectCodeEditor();
    await switchToMode(QueryEditorMode.Builder);
    expect(onChange).toBeCalledWith({
      refId: 'A',
      expr: defaultQuery.expr,
      queryType: LokiQueryType.Range,
      editorMode: QueryEditorMode.Builder,
    });
  });

  it('Should show the query by default', async () => {
    renderWithProps({
      editorMode: QueryEditorMode.Builder,
      expr: '{job="grafana"}',
    });
    const selector = await screen.findByLabelText('selector');
    expect(selector).toBeInTheDocument();
    expect(selector.textContent).toBe('{job="grafana"}');
  });

  it('Can enable explain', async () => {
    renderWithMode(QueryEditorMode.Builder);
    expect(screen.queryByText(EXPLAIN_LABEL_FILTER_CONTENT)).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Explain query'));
    expect(await screen.findByText(EXPLAIN_LABEL_FILTER_CONTENT)).toBeInTheDocument();
  });

  it('changes to code mode', async () => {
    const { onChange } = renderWithMode(QueryEditorMode.Builder);

    await expectBuilder();

    await switchToMode(QueryEditorMode.Code);

    expect(onChange).toBeCalledWith({
      refId: 'A',
      expr: defaultQuery.expr,
      queryType: LokiQueryType.Range,
      editorMode: QueryEditorMode.Code,
    });
  });

  it('parses query when changing to builder mode', async () => {
    const { rerender } = renderWithProps({
      refId: 'A',
      expr: 'rate({instance="host.docker.internal:3000"}[$__interval])',
      editorMode: QueryEditorMode.Code,
    });
    await expectCodeEditor();
    await switchToMode(QueryEditorMode.Builder);
    rerender(
      <LokiQueryEditor
        {...defaultProps}
        query={{
          refId: 'A',
          expr: 'rate({instance="host.docker.internal:3000"}[$__interval])',
          editorMode: QueryEditorMode.Builder,
        }}
      />
    );

    await screen.findByText('host.docker.internal:3000');
    expect(screen.getByText('Rate')).toBeInTheDocument();
    expect(screen.getByText('$__interval')).toBeInTheDocument();
  });

  it('renders the label browser button', async () => {
    renderWithMode(QueryEditorMode.Code);
    expect(await screen.findByTestId('label-browser-button')).toBeInTheDocument();
  });
});

function renderWithMode(mode: QueryEditorMode) {
  return renderWithProps({ editorMode: mode });
}

function renderWithProps(overrides?: Partial<LokiQuery>, componentProps: Partial<LokiQueryEditorProps> = {}) {
  const query = defaultsDeep(overrides ?? {}, cloneDeep(defaultQuery));
  const onChange = jest.fn();

  const allProps = { ...defaultProps, ...componentProps };
  const stuff = render(<LokiQueryEditor {...allProps} query={query} onChange={onChange} />);
  return { onChange, ...stuff };
}

async function expectCodeEditor() {
  expect(await screen.findByText('MonacoQueryFieldWrapper')).toBeInTheDocument();
}

async function expectBuilder() {
  expect(await screen.findByText('Label filters')).toBeInTheDocument();
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

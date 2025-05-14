import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cloneDeep, defaultsDeep } from 'lodash';

import { CoreApp } from '@grafana/data';
import { QueryEditorMode } from '@grafana/plugin-ui';

import { createLokiDatasource } from '../__mocks__/datasource';
import { EXPLAIN_LABEL_FILTER_CONTENT } from '../querybuilder/components/LokiQueryBuilderExplained';
import { LokiQuery, LokiQueryType } from '../types';

import { LokiQueryEditor } from './LokiQueryEditor';
import { LokiQueryEditorProps } from './types';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    getAppEvents: jest.fn().mockReturnValue({
      subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    }),
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
  // We need to clear local storage after each test because we are using it to store the editor mode and enabled explain
  afterEach(() => {
    window.localStorage.clear();
  });
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

  it('shows Run Query button in Dashboards', async () => {
    renderWithProps({}, { app: CoreApp.Dashboard });
    await expectRunQueryButton();
  });

  it('hides Run Query button in Explore', async () => {
    renderWithProps({}, { app: CoreApp.Explore });
    await expectCodeEditor();
    expectNoRunQueryButton();
  });

  it('hides Run Query button in Correlations Page', async () => {
    renderWithProps({}, { app: CoreApp.Correlations });
    await expectCodeEditor();
    expectNoRunQueryButton();
  });

  it('shows Run Queries button in Dashboards when multiple queries', async () => {
    renderWithProps({}, { app: CoreApp.Dashboard, queries: [defaultQuery, defaultQuery] });
    await expectRunQueriesButton();
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

async function expectRunQueryButton() {
  expect(await screen.findByRole('button', { name: /run query/i })).toBeInTheDocument();
}

function expectNoRunQueryButton() {
  expect(screen.queryByRole('button', { name: /run query/i })).not.toBeInTheDocument();
}

async function switchToMode(mode: QueryEditorMode) {
  const label = {
    [QueryEditorMode.Code]: /Code/,
    [QueryEditorMode.Builder]: /Builder/,
  }[mode];

  const switchEl = screen.getByLabelText(label);
  await userEvent.click(switchEl);
}

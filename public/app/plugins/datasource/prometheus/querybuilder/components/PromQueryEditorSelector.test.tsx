import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromQueryEditorSelector } from './PromQueryEditorSelector';
import { PrometheusDatasource } from '../../datasource';
import { QueryEditorMode } from '../shared/types';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';
import PromQlLanguageProvider from '../../language_provider';
import { cloneDeep, defaultsDeep } from 'lodash';
import { PromQuery } from '../../types';

// We need to mock this because it seems jest has problem importing monaco in tests
jest.mock('../../components/monaco-query-field/MonacoQueryFieldWrapper', () => {
  return {
    MonacoQueryFieldWrapper: () => {
      return 'MonacoQueryFieldWrapper';
    },
  };
});

const defaultQuery = {
  refId: 'A',
  expr: 'metric{label1="foo", label2="bar"}',
};

const defaultProps = {
  datasource: new PrometheusDatasource(
    {
      id: 1,
      uid: '',
      type: 'prometheus',
      name: 'prom-test',
      access: 'proxy',
      url: '',
      jsonData: {},
      meta: {} as any,
    },
    undefined,
    undefined,
    new EmptyLanguageProviderMock() as unknown as PromQlLanguageProvider
  ),
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

  it('shows builder if new query', async () => {
    render(
      <PromQueryEditorSelector
        {...defaultProps}
        query={{
          refId: 'A',
          expr: '',
        }}
      />
    );
    expectBuilder();
  });

  it('shows code editor when code mode is set', async () => {
    renderWithMode(QueryEditorMode.Code);
    expectCodeEditor();
  });

  it('shows builder when builder mode is set', async () => {
    renderWithMode(QueryEditorMode.Builder);
    expectBuilder();
  });

  it('shows explain when explain mode is set', async () => {
    renderWithMode(QueryEditorMode.Explain);
    expectExplain();
  });

  it('changes to builder mode', async () => {
    const { onChange } = renderWithMode(QueryEditorMode.Code);
    switchToMode(QueryEditorMode.Builder);
    expect(onChange).toBeCalledWith({
      refId: 'A',
      expr: defaultQuery.expr,
      instant: false,
      range: true,
      editorMode: QueryEditorMode.Builder,
    });
  });

  it('Can enable preview', async () => {
    const { onChange } = renderWithMode(QueryEditorMode.Builder);
    expect(screen.queryByLabelText('selector')).not.toBeInTheDocument();

    screen.getByLabelText('Preview').click();

    expect(onChange).toBeCalledWith({
      refId: 'A',
      expr: defaultQuery.expr,
      instant: false,
      range: true,
      editorMode: QueryEditorMode.Builder,
      editorPreview: true,
    });
  });

  it('Should show preview', async () => {
    renderWithProps({
      editorPreview: true,
      editorMode: QueryEditorMode.Builder,
      expr: 'my_metric',
    });
    expect(screen.getByLabelText('selector').textContent).toBe('my_metric');
  });

  it('changes to code mode', async () => {
    const { onChange } = renderWithMode(QueryEditorMode.Builder);
    switchToMode(QueryEditorMode.Code);
    expect(onChange).toBeCalledWith({
      refId: 'A',
      expr: defaultQuery.expr,
      instant: false,
      range: true,
      editorMode: QueryEditorMode.Code,
    });
  });

  it('changes to explain mode', async () => {
    const { onChange } = renderWithMode(QueryEditorMode.Code);
    switchToMode(QueryEditorMode.Explain);
    expect(onChange).toBeCalledWith({
      refId: 'A',
      expr: defaultQuery.expr,
      instant: false,
      range: true,
      editorMode: QueryEditorMode.Explain,
    });
  });

  it('parses query when changing to builder mode', async () => {
    const { rerender } = renderWithProps({
      refId: 'A',
      expr: 'rate(test_metric{instance="host.docker.internal:3000"}[$__interval])',
      editorMode: QueryEditorMode.Code,
    });
    switchToMode(QueryEditorMode.Builder);
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
  return renderWithProps({ editorMode: mode } as any);
}

function renderWithProps(overrides?: Partial<PromQuery>) {
  const query = defaultsDeep(overrides ?? {}, cloneDeep(defaultQuery));
  const onChange = jest.fn();

  const stuff = render(<PromQueryEditorSelector {...defaultProps} query={query} onChange={onChange} />);
  return { onChange, ...stuff };
}

function expectCodeEditor() {
  // Metric browser shows this until metrics are loaded.
  expect(screen.getByText('Loading metrics...')).toBeInTheDocument();
}

function expectBuilder() {
  expect(screen.getByText('Metric')).toBeInTheDocument();
}

function expectExplain() {
  // Base message when there is no query
  expect(screen.getByText(/Fetch all series/)).toBeInTheDocument();
}

function switchToMode(mode: QueryEditorMode) {
  const label = {
    [QueryEditorMode.Code]: 'Code',
    [QueryEditorMode.Explain]: 'Explain',
    [QueryEditorMode.Builder]: 'Builder',
  }[mode];

  const switchEl = screen.getByLabelText(label);
  userEvent.click(switchEl);
}

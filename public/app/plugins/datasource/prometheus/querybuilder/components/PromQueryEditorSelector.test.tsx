import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cloneDeep, defaultsDeep } from 'lodash';
import React from 'react';

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
    getObject(key: string, defaultValue: any) {
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
      readOnly: false,
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

  it('shows code editor when code mode is set', async () => {
    renderWithMode(QueryEditorMode.Code);
    expectCodeEditor();
  });

  it('shows builder when builder mode is set', async () => {
    renderWithMode(QueryEditorMode.Builder);
    expectBuilder();
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

  it('Can enable raw query', async () => {
    renderWithMode(QueryEditorMode.Builder);
    expect(screen.queryByLabelText('selector')).toBeInTheDocument();
    screen.getByLabelText('Raw query').click();
    expect(screen.queryByLabelText('selector')).not.toBeInTheDocument();
  });

  it('Should show raw query by default', async () => {
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

async function switchToMode(mode: QueryEditorMode) {
  const label = {
    [QueryEditorMode.Code]: /Code/,
    [QueryEditorMode.Builder]: /Builder/,
  }[mode];

  const switchEl = screen.getByLabelText(label);
  await userEvent.click(switchEl);
}

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cloneDeep, defaultsDeep } from 'lodash';
import React from 'react';

import { config } from '@grafana/runtime';
import { QueryEditorMode } from 'app/plugins/datasource/prometheus/querybuilder/shared/types';

import { createLokiDatasource } from '../mocks';
import { EXPLAIN_LABEL_FILTER_CONTENT } from '../querybuilder/components/LokiQueryBuilderExplained';
import { LokiQuery, LokiQueryType } from '../types';

import { LokiQueryEditor } from './LokiQueryEditor';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
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

beforeAll(() => {
  config.featureToggles.lokiMonacoEditor = true;
});

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

  it('Can enable raw query', async () => {
    renderWithMode(QueryEditorMode.Builder);
    expect(await screen.findByLabelText('selector')).toBeInTheDocument();
    screen.getByLabelText('Raw query').click();
    expect(screen.queryByLabelText('selector')).not.toBeInTheDocument();
  });

  it('Should show raw query by default', async () => {
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
    screen.getByLabelText('Explain').click();
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
});

function renderWithMode(mode: QueryEditorMode) {
  return renderWithProps({ editorMode: mode });
}

function renderWithProps(overrides?: Partial<LokiQuery>) {
  const query = defaultsDeep(overrides ?? {}, cloneDeep(defaultQuery));
  const onChange = jest.fn();

  const stuff = render(<LokiQueryEditor {...defaultProps} query={query} onChange={onChange} />);
  return { onChange, ...stuff };
}

async function expectCodeEditor() {
  // Label browser shows this until log labels are loaded.
  expect(await screen.findByText('Loading...')).toBeInTheDocument();
}

async function expectBuilder() {
  expect(await screen.findByText('Label filters')).toBeInTheDocument();
}

async function switchToMode(mode: QueryEditorMode) {
  const label = {
    [QueryEditorMode.Code]: /Code/,
    [QueryEditorMode.Builder]: /Builder/,
  }[mode];

  const switchEl = screen.getByLabelText(label);
  await userEvent.click(switchEl);
}

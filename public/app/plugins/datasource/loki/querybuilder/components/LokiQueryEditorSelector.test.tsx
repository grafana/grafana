import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cloneDeep, defaultsDeep } from 'lodash';
import React from 'react';

import { QueryEditorMode } from 'app/plugins/datasource/prometheus/querybuilder/shared/types';

import { LokiDatasource } from '../../datasource';
import { LokiQuery, LokiQueryType } from '../../types';

import { LokiQueryEditorSelector } from './LokiQueryEditorSelector';

const defaultQuery = {
  refId: 'A',
  expr: '{label1="foo", label2="bar"}',
};

const datasource = new LokiDatasource(
  {
    id: 1,
    uid: '',
    type: 'loki',
    name: 'loki-test',
    access: 'proxy',
    url: '',
    jsonData: {},
    meta: {} as any,
  },
  undefined,
  undefined
);

datasource.languageProvider.fetchLabels = jest.fn().mockResolvedValue([]);

const defaultProps = {
  datasource,
  query: defaultQuery,
  onRunQuery: () => {},
  onChange: () => {},
};

describe('LokiQueryEditorSelector', () => {
  it('shows code editor if expr and nothing else', async () => {
    // We opt for showing code editor for queries created before this feature was added
    render(<LokiQueryEditorSelector {...defaultProps} />);
    expectCodeEditor();
  });

  it('shows builder if new query', async () => {
    render(
      <LokiQueryEditorSelector
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
      queryType: LokiQueryType.Range,
      editorMode: QueryEditorMode.Builder,
      visualQuery: {
        labels: [
          { label: 'label1', op: '=', value: 'foo' },
          { label: 'label2', op: '=', value: 'bar' },
        ],
        operations: [],
      },
    });
  });

  // it('Can enable preview', async () => {
  //   const { onChange } = renderWithMode(QueryEditorMode.Builder);
  //   expect(screen.queryByLabelText('selector')).not.toBeInTheDocument();

  //   screen.getByLabelText('Preview').click();

  //   expect(onChange).toBeCalledWith({
  //     refId: 'A',
  //     expr: defaultQuery.expr,
  //     range: true,
  //     editorMode: QueryEditorMode.Builder,
  //     editorPreview: true,
  //   });
  // });

  // it('Should show preview', async () => {
  //   renderWithProps({
  //     editorPreview: true,
  //     editorMode: QueryEditorMode.Builder,
  //     expr: 'my_metric',
  //   });
  //   expect(screen.getByLabelText('selector').textContent).toBe('my_metric');
  // });

  it('changes to code mode', async () => {
    const { onChange } = renderWithMode(QueryEditorMode.Builder);
    switchToMode(QueryEditorMode.Code);
    expect(onChange).toBeCalledWith({
      refId: 'A',
      expr: defaultQuery.expr,
      queryType: LokiQueryType.Range,
      editorMode: QueryEditorMode.Code,
    });
  });

  it('changes to explain mode', async () => {
    const { onChange } = renderWithMode(QueryEditorMode.Code);
    switchToMode(QueryEditorMode.Explain);
    expect(onChange).toBeCalledWith({
      refId: 'A',
      expr: defaultQuery.expr,
      queryType: LokiQueryType.Range,
      editorMode: QueryEditorMode.Explain,
    });
  });

  it('parses query when changing to builder mode', async () => {
    const { rerender } = renderWithProps({
      refId: 'A',
      expr: 'rate({instance="host.docker.internal:3000"}[$__interval])',
      editorMode: QueryEditorMode.Code,
    });
    switchToMode(QueryEditorMode.Builder);
    rerender(
      <LokiQueryEditorSelector
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
  return renderWithProps({ editorMode: mode } as any);
}

function renderWithProps(overrides?: Partial<LokiQuery>) {
  const query = defaultsDeep(overrides ?? {}, cloneDeep(defaultQuery));
  const onChange = jest.fn();

  const stuff = render(<LokiQueryEditorSelector {...defaultProps} query={query} onChange={onChange} />);
  return { onChange, ...stuff };
}

function expectCodeEditor() {
  // Log browser shows this until log labels are loaded.
  expect(screen.getByText('Loading labels...')).toBeInTheDocument();
}

function expectBuilder() {
  expect(screen.getByText('Labels')).toBeInTheDocument();
}

function expectExplain() {
  // Base message when there is no query
  expect(screen.getByText(/Fetch all log/)).toBeInTheDocument();
}

function switchToMode(mode: QueryEditorMode) {
  const label = {
    [QueryEditorMode.Code]: /Code/,
    [QueryEditorMode.Explain]: /Explain/,
    [QueryEditorMode.Builder]: /Builder/,
  }[mode];

  const switchEl = screen.getByLabelText(label);
  userEvent.click(switchEl);
}

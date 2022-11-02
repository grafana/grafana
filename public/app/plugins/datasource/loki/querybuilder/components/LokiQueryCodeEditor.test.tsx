import { render, screen } from '@testing-library/react';
import React from 'react';

import { config } from '@grafana/runtime';

import { createLokiDatasource } from '../../mocks';
import { LokiQuery } from '../../types';

import { EXPLAIN_LABEL_FILTER_CONTENT } from './LokiQueryBuilderExplained';
import { LokiQueryCodeEditor } from './LokiQueryCodeEditor';

const defaultQuery: LokiQuery = {
  expr: '{job="bar}',
  refId: 'A',
};

const createDefaultProps = () => {
  const datasource = createLokiDatasource();

  const props = {
    datasource,
    onRunQuery: () => {},
    onChange: () => {},
    showExplain: false,
  };

  return props;
};

beforeAll(() => {
  config.featureToggles.lokiMonacoEditor = true;
});

describe('LokiQueryCodeEditor', () => {
  it('shows explain section when showExplain is true', async () => {
    const props = createDefaultProps();
    props.showExplain = true;
    props.datasource.metadataRequest = jest.fn().mockResolvedValue([]);
    render(<LokiQueryCodeEditor {...props} query={defaultQuery} />);
    expect(await screen.findByText('Loading...')).toBeInTheDocument();
    expect(screen.getByText(EXPLAIN_LABEL_FILTER_CONTENT)).toBeInTheDocument();
  });

  it('does not show explain section when showExplain is false', async () => {
    const props = createDefaultProps();
    props.datasource.metadataRequest = jest.fn().mockResolvedValue([]);
    render(<LokiQueryCodeEditor {...props} query={defaultQuery} />);
    expect(await screen.findByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText(EXPLAIN_LABEL_FILTER_CONTENT)).not.toBeInTheDocument();
  });
});

import { render, waitFor, screen } from '@testing-library/react';
import { select } from 'react-select-event';

import { selectors } from '../e2e/selectors';
import { createMockDatasource } from '../mocks/cloudMonitoringDatasource';
import { createMockQuery } from '../mocks/cloudMonitoringQuery';
import { QueryType } from '../types/query';

import { QueryEditor } from './QueryEditor';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: (val: string) => val,
  }),
}));

const defaultProps = {
  refId: 'A',
  customMetaData: {},
  variableOptionGroup: { options: [] },
  onChange: jest.fn(),
  onRunQuery: jest.fn(),
  query: createMockQuery(),
  datasource: createMockDatasource(),
};

describe('QueryEditor', () => {
  it('should migrate the given query', async () => {
    const datasource = createMockDatasource();
    const onChange = jest.fn();
    datasource.migrateQuery = jest.fn().mockReturnValue(defaultProps.query);

    render(<QueryEditor {...defaultProps} query={{ refId: 'A' }} datasource={datasource} onChange={onChange} />);
    await waitFor(() => expect(datasource.migrateQuery).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(defaultProps.query));
  });

  it('should set a known query type', async () => {
    const query = createMockQuery();
    query.queryType = 'other' as QueryType;
    const onChange = jest.fn();

    render(<QueryEditor {...defaultProps} query={query} onChange={onChange} />);
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ queryType: QueryType.TIME_SERIES_LIST }))
    );
  });

  it('renders the visual metrics query editor when the query type is timeSeriesList', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: QueryType.TIME_SERIES_LIST,
    };

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
    await waitFor(() =>
      expect(
        screen.getByTestId(selectors.components.queryEditor.visualMetricsQueryEditor.container.input)
      ).toBeInTheDocument()
    );
  });
  it('renders the visual metrics query editor when the query type is timeSeriesList', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: QueryType.TIME_SERIES_LIST,
    };

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
    await waitFor(() =>
      expect(
        screen.getByTestId(selectors.components.queryEditor.visualMetricsQueryEditor.container.input)
      ).toBeInTheDocument()
    );
  });
  it('renders the mql metrics query editor when the query type is timeSeriesQuery', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: QueryType.TIME_SERIES_QUERY,
    };

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
    await waitFor(() =>
      expect(
        screen.getByTestId(selectors.components.queryEditor.mqlMetricsQueryEditor.container.input)
      ).toBeInTheDocument()
    );
  });

  it('renders the SLO query editor when the query type is SLO', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: QueryType.SLO,
    };

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
    await waitFor(() =>
      expect(screen.getByTestId(selectors.components.queryEditor.sloQueryEditor.container.input)).toBeInTheDocument()
    );
  });

  it('renders the PromQL query editor when the query type is PromQL', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: QueryType.PROMQL,
    };

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
    await waitFor(() =>
      expect(screen.getByTestId(selectors.components.queryEditor.promQlQueryEditor.container.input)).toBeInTheDocument()
    );
  });

  it('changes the query type when selected', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = createMockQuery();
    const onChange = jest.fn();
    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={onChange} onRunQuery={() => {}} />);
    await waitFor(() => expect(screen.getByTestId(selectors.components.queryEditor.container)).toBeInTheDocument());

    const queryType = await screen.findByLabelText(/Query type/);

    await waitFor(() => select(queryType, 'PromQL', { container: document.body }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        refId: mockQuery.refId,
        datasource: mockQuery.datasource,
        queryType: QueryType.PROMQL,
      })
    );
  });
});

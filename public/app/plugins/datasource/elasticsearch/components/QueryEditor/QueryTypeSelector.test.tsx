import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ElasticsearchDataQuery } from '../../dataquery.gen';
import { ElasticDatasource } from '../../datasource';
import { useDispatch } from '../../hooks/useStatelessReducer';
import { renderWithESProvider } from '../../test-helpers/render';

import { changeMetricType } from './MetricAggregationsEditor/state/actions';
import { QueryTypeSelector } from './QueryTypeSelector';

jest.mock('../../hooks/useStatelessReducer');

describe('QueryTypeSelector', () => {
  let dispatch: jest.Mock;

  beforeEach(() => {
    dispatch = jest.fn();
    jest.mocked(useDispatch).mockReturnValue(dispatch);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render radio buttons with correct options', () => {
    const query: ElasticsearchDataQuery = {
      refId: 'A',
      query: '',
      metrics: [{ id: '1', type: 'count' }],
      bucketAggs: [{ type: 'date_histogram', id: '2' }],
    };

    const datasource = { defaultQueryMode: 'metrics' } as ElasticDatasource;

    renderWithESProvider(<QueryTypeSelector />, { providerProps: { query, datasource } });

    expect(screen.getByRole('radio', { name: 'Metrics' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Logs' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Raw Data' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Raw Document' })).toBeInTheDocument();
  });

  it('should select the correct radio button based on defaultQueryMode', () => {
    const query: ElasticsearchDataQuery = {
      refId: 'A',
      query: '',
      metrics: [{ id: '1', type: 'count' }],
      bucketAggs: [{ type: 'date_histogram', id: '2' }],
    };

    const datasource = { defaultQueryMode: 'logs' } as ElasticDatasource;

    renderWithESProvider(<QueryTypeSelector />, { providerProps: { query, datasource } });

    const logsRadio = screen.getByRole('radio', { name: 'Logs' });
    expect(logsRadio).toBeChecked();
  });

  it('should fallback to impliedQueryType when defaultQueryMode is undefined', () => {
    const query: ElasticsearchDataQuery = {
      refId: 'A',
      query: '',
      metrics: [{ id: '1', type: 'count' }],
      bucketAggs: [{ type: 'date_histogram', id: '2' }],
    };

    const datasource = {} as ElasticDatasource;

    renderWithESProvider(<QueryTypeSelector />, { providerProps: { query, datasource } });

    const metricsRadio = screen.getByRole('radio', { name: 'Metrics' });
    expect(metricsRadio).toBeChecked();
  });

  it('should fallback to impliedQueryType when defaultQueryMode is explicitly undefined', () => {
    const query: ElasticsearchDataQuery = {
      refId: 'A',
      query: '',
      metrics: [{ id: '1', type: 'logs' }],
      bucketAggs: [{ type: 'date_histogram', id: '2' }],
    };

    const datasource = { defaultQueryMode: undefined } as ElasticDatasource;

    renderWithESProvider(<QueryTypeSelector />, { providerProps: { query, datasource } });

    const logsRadio = screen.getByRole('radio', { name: 'Logs' });
    expect(logsRadio).toBeChecked();
  });

  it('should dispatch changeMetricType action when radio button is changed', async () => {
    const query: ElasticsearchDataQuery = {
      refId: 'A',
      query: '',
      metrics: [{ id: '1', type: 'count' }],
      bucketAggs: [{ type: 'date_histogram', id: '2' }],
    };

    const datasource = { defaultQueryMode: 'metrics' } as ElasticDatasource;

    renderWithESProvider(<QueryTypeSelector />, { providerProps: { query, datasource } });

    const logsRadio = screen.getByRole('radio', { name: 'Logs' });
    await userEvent.click(logsRadio);

    expect(dispatch).toHaveBeenCalledWith(changeMetricType({ id: '1', type: 'logs' }));
  });

  it('should convert query type to metric type correctly for raw_data', async () => {
    const query: ElasticsearchDataQuery = {
      refId: 'A',
      query: '',
      metrics: [{ id: '1', type: 'count' }],
      bucketAggs: [{ type: 'date_histogram', id: '2' }],
    };

    const datasource = { defaultQueryMode: 'metrics' } as ElasticDatasource;

    renderWithESProvider(<QueryTypeSelector />, { providerProps: { query, datasource } });

    const rawDataRadio = screen.getByRole('radio', { name: 'Raw Data' });
    await userEvent.click(rawDataRadio);

    expect(dispatch).toHaveBeenCalledWith(changeMetricType({ id: '1', type: 'raw_data' }));
  });

  it('should convert query type to metric type correctly for raw_document', async () => {
    const query: ElasticsearchDataQuery = {
      refId: 'A',
      query: '',
      metrics: [{ id: '1', type: 'count' }],
      bucketAggs: [{ type: 'date_histogram', id: '2' }],
    };

    const datasource = { defaultQueryMode: 'metrics' } as ElasticDatasource;

    renderWithESProvider(<QueryTypeSelector />, { providerProps: { query, datasource } });

    const rawDocumentRadio = screen.getByRole('radio', { name: 'Raw Document' });
    await userEvent.click(rawDocumentRadio);

    expect(dispatch).toHaveBeenCalledWith(changeMetricType({ id: '1', type: 'raw_document' }));
  });

  it('should convert metrics query type to count metric type', async () => {
    const query: ElasticsearchDataQuery = {
      refId: 'A',
      query: '',
      metrics: [{ id: '1', type: 'logs' }],
      bucketAggs: [{ type: 'date_histogram', id: '2' }],
    };

    const datasource = { defaultQueryMode: 'logs' } as ElasticDatasource;

    renderWithESProvider(<QueryTypeSelector />, { providerProps: { query, datasource } });

    const metricsRadio = screen.getByRole('radio', { name: 'Metrics' });
    await userEvent.click(metricsRadio);

    expect(dispatch).toHaveBeenCalledWith(changeMetricType({ id: '1', type: 'count' }));
  });

  it('should return null when query has no metrics', () => {
    const query: ElasticsearchDataQuery = {
      refId: 'A',
      query: '',
      metrics: [],
      bucketAggs: [{ type: 'date_histogram', id: '2' }],
    };

    const datasource = { defaultQueryMode: 'metrics' } as ElasticDatasource;

    const { container } = renderWithESProvider(<QueryTypeSelector />, { providerProps: { query, datasource } });

    expect(container.firstChild).toBeNull();
  });
});

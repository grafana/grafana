// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/shared/OperationList.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataSourceApi, DataSourceInstanceSettings } from '@grafana/data';

import { PrometheusDatasource } from '../../datasource';
import { PrometheusLanguageProviderInterface } from '../../language_provider';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';
import { getMockTimeRange } from '../../test/mocks/datasource';
import { PromOptions } from '../../types';
import { addOperationInQueryBuilder } from '../testUtils';
import { PromVisualQuery } from '../types';

import { OperationList } from './OperationList';
import { promQueryModeller } from './modeller_instance';

const defaultQuery: PromVisualQuery = {
  metric: 'random_metric',
  labels: [{ label: 'instance', op: '=', value: 'localhost:9090' }],
  operations: [
    {
      id: 'rate',
      params: ['auto'],
    },
    {
      id: '__sum_by',
      params: ['instance', 'job'],
    },
  ],
};

describe('OperationList', () => {
  it('renders operations', async () => {
    setup();
    expect(screen.getByText('Rate')).toBeInTheDocument();
    expect(screen.getByText('Sum by')).toBeInTheDocument();
  });

  it('removes an operation', async () => {
    const { onChange } = setup();
    const removeOperationButtons = screen.getAllByLabelText('Remove operation');
    expect(removeOperationButtons).toHaveLength(2);
    await userEvent.click(removeOperationButtons[1]);
    expect(onChange).toHaveBeenCalledWith({
      labels: [{ label: 'instance', op: '=', value: 'localhost:9090' }],
      metric: 'random_metric',
      operations: [{ id: 'rate', params: ['auto'] }],
    });
  });

  it('adds an operation', async () => {
    const { onChange } = setup();
    await addOperationInQueryBuilder('Aggregations', 'Min');
    expect(onChange).toHaveBeenCalledWith({
      labels: [{ label: 'instance', op: '=', value: 'localhost:9090' }],
      metric: 'random_metric',
      operations: [
        { id: 'rate', params: ['auto'] },
        { id: '__sum_by', params: ['instance', 'job'] },
        { id: 'min', params: [] },
      ],
    });
  });
});

function setup(query: PromVisualQuery = defaultQuery) {
  const languageProvider = new EmptyLanguageProviderMock() as unknown as PrometheusLanguageProviderInterface;
  const props = {
    datasource: new PrometheusDatasource(
      {
        url: '',
        jsonData: {},
        meta: {},
      } as DataSourceInstanceSettings<PromOptions>,
      undefined,
      languageProvider
    ) as DataSourceApi,
    onRunQuery: () => {},
    onChange: jest.fn(),
    queryModeller: promQueryModeller,
    timeRange: getMockTimeRange(),
  };

  render(<OperationList {...props} query={query} />);
  return props;
}

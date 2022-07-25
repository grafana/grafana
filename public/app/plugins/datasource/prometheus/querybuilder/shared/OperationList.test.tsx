import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DataSourceApi } from '@grafana/data';

import { PrometheusDatasource } from '../../datasource';
import PromQlLanguageProvider from '../../language_provider';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';
import { promQueryModeller } from '../PromQueryModeller';
import { PromVisualQuery } from '../types';

import { OperationList } from './OperationList';
import { addOperation } from './OperationList.testUtils';

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
    const removeOperationButtons = screen.getAllByTitle('Remove operation');
    expect(removeOperationButtons).toHaveLength(2);
    await userEvent.click(removeOperationButtons[1]);
    expect(onChange).toBeCalledWith({
      labels: [{ label: 'instance', op: '=', value: 'localhost:9090' }],
      metric: 'random_metric',
      operations: [{ id: 'rate', params: ['auto'] }],
    });
  });

  it('adds an operation', async () => {
    const { onChange } = setup();
    await addOperation('Aggregations', 'Min');
    expect(onChange).toBeCalledWith({
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
  const languageProvider = new EmptyLanguageProviderMock() as unknown as PromQlLanguageProvider;
  const props = {
    datasource: new PrometheusDatasource(
      {
        url: '',
        jsonData: {},
        meta: {} as any,
      } as any,
      undefined,
      undefined,
      languageProvider
    ) as DataSourceApi,
    onRunQuery: () => {},
    onChange: jest.fn(),
    queryModeller: promQueryModeller,
  };

  render(<OperationList {...props} query={query} />);
  return props;
}

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DataSourceInstanceSettings, DataSourcePluginMeta, PanelData } from '@grafana/data';

import { PrometheusDatasource } from '../../datasource';
import PromQlLanguageProvider from '../../language_provider';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';
import { PromOptions } from '../../types';
import { PromVisualQuery } from '../types';

import { MetricEncyclopediaModal } from './MetricEncyclopediaModal';

// don't care about interaction tracking in our unit tests
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const defaultQuery: PromVisualQuery = {
  metric: 'random_metric',
  labels: [],
  operations: [],
};

function createDatasource(options?: Partial<DataSourceInstanceSettings<PromOptions>>) {
  const languageProvider = new EmptyLanguageProviderMock() as unknown as PromQlLanguageProvider;
  const datasource = new PrometheusDatasource(
    {
      url: '',
      jsonData: {},
      meta: {} as DataSourcePluginMeta,
      ...options,
    } as DataSourceInstanceSettings<PromOptions>,
    undefined,
    undefined,
    languageProvider
  );
  return datasource;
}

function createProps(datasource: PrometheusDatasource) {
  return {
    datasource,
    isOpen: true,
    onChange: jest.fn(),
    onClose: jest.fn(),
    query: defaultQuery,
  };
}

function setup() {
  const datasource = createDatasource();
  const props = createProps(datasource);

  // render the modal only
  render(<MetricEncyclopediaModal {...props} />);
}

describe('MetricEncyclopediaModal', () => {
  it('renders the modal', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByText('Select Metric')).toBeInTheDocument();
    });
  });

  // it('renders a list of metrics', async () => {

  // });

  // it('displays a type for a metric', async () => {

  // });

  // it('displays a description for a metric', async () => {

  // });

  // it('paginates the list of metrics', async () => {

  // });

  // it('shows an amount of metrics per page chosen by the user', async () => {

  // });
});

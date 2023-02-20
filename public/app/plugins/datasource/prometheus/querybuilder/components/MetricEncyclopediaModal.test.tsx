import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';

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

const listOfMetrics: string[] = ['all-metrics', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

function createDatasource(withLabels?: boolean) {
  const languageProvider = new EmptyLanguageProviderMock() as unknown as PromQlLanguageProvider;

  // display different results if their are labels selected in the PromVisualQuery
  if (withLabels) {
    languageProvider.getSeries = () => Promise.resolve({ __name__: ['with-labels'] });
    languageProvider.metricsMetadata = {
      'with-labels': {
        type: 'with-labels-type',
        help: 'with-labels-help',
      },
    };
  } else {
    // all metrics
    languageProvider.getLabelValues = () => Promise.resolve(listOfMetrics);
    languageProvider.metricsMetadata = {
      'all-metrics': {
        type: 'all-metrics-type',
        help: 'all-metrics-help',
      },
      // missing metadata for other metrics is tested for, see below
    };
  }

  const datasource = new PrometheusDatasource(
    {
      url: '',
      jsonData: {},
      meta: {} as DataSourcePluginMeta,
    } as DataSourceInstanceSettings<PromOptions>,
    undefined,
    undefined,
    languageProvider
  );
  return datasource;
}

function createProps(query: PromVisualQuery, datasource: PrometheusDatasource) {
  return {
    datasource,
    isOpen: true,
    onChange: jest.fn(),
    onClose: jest.fn(),
    query: query,
  };
}

function setup(query: PromVisualQuery, withlabels?: boolean) {
  const withLabels: boolean = query.labels.length > 0;
  const datasource = createDatasource(withLabels);
  const props = createProps(query, datasource);

  // render the modal only
  render(<MetricEncyclopediaModal {...props} />);
}

describe('MetricEncyclopediaModal', () => {
  it('renders the modal', async () => {
    setup(defaultQuery);
    await waitFor(() => {
      expect(screen.getByText('Select Metric')).toBeInTheDocument();
    });
  });

  it('renders a list of metrics', async () => {
    setup(defaultQuery);
    await waitFor(() => {
      expect(screen.getByText('all-metrics')).toBeInTheDocument();
    });
  });

  it('renders a list of metrics filtered by labels in the PromVisualQuery', async () => {
    const query: PromVisualQuery = {
      metric: 'random_metric',
      labels: [
        {
          op: '=',
          label: 'action',
          value: 'add_presence',
        },
      ],
      operations: [],
    };

    setup(query);
    await waitFor(() => {
      expect(screen.getByText('with-labels')).toBeInTheDocument();
    });
  });

  it('displays a type for a metric when the metric is clicked', async () => {
    setup(defaultQuery);
    await waitFor(() => {
      expect(screen.getByText('all-metrics')).toBeInTheDocument();
    });

    const interactiveMetric = screen.getByText('all-metrics');

    await userEvent.click(interactiveMetric);

    expect(screen.getByText('all-metrics-type')).toBeInTheDocument();
  });

  it('displays a description for a metric', async () => {
    setup(defaultQuery);
    await waitFor(() => {
      expect(screen.getByText('all-metrics')).toBeInTheDocument();
    });

    const interactiveMetric = screen.getByText('all-metrics');

    await userEvent.click(interactiveMetric);

    expect(screen.getByText('all-metrics-help')).toBeInTheDocument();
  });

  it('displays no metadata for a metric missing metadata when the metric is clicked', async () => {
    setup(defaultQuery);
    await waitFor(() => {
      expect(screen.getByText('a')).toBeInTheDocument();
    });

    const interactiveMetric = screen.getByText('a');

    await userEvent.click(interactiveMetric);

    expect(screen.getByText('No metadata available')).toBeInTheDocument();
  });

  // Pagination
  it('shows metrics within a range by pagination', async () => {
    // default resultsPerPage is 10
    setup(defaultQuery);
    await waitFor(() => {
      expect(screen.getByText('all-metrics')).toBeInTheDocument();
      expect(screen.getByText('a')).toBeInTheDocument();
      expect(screen.getByText('b')).toBeInTheDocument();
      expect(screen.getByText('c')).toBeInTheDocument();
      expect(screen.getByText('d')).toBeInTheDocument();
      expect(screen.getByText('e')).toBeInTheDocument();
      expect(screen.getByText('f')).toBeInTheDocument();
      expect(screen.getByText('g')).toBeInTheDocument();
      expect(screen.getByText('h')).toBeInTheDocument();
      expect(screen.getByText('i')).toBeInTheDocument();
    });
  });

  it('does not show metrics outside a range by pagination', async () => {
    // default resultsPerPage is 10
    setup(defaultQuery);
    await waitFor(() => {
      const metricOutsideRange = screen.queryByText('j');
      expect(metricOutsideRange).toBeNull();
    });
  });

  it('shows results metrics per page chosen by the user', async () => {
    setup(defaultQuery);
    const resultsPerPageInput = screen.getByTestId('results-per-page');
    await userEvent.type(resultsPerPageInput, '11');
    const metricInsideRange = screen.getByText('j');
    expect(metricInsideRange).toBeInTheDocument();
  });
});

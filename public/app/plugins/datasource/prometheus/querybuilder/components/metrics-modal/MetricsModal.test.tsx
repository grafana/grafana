import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';

import { PrometheusDatasource } from '../../../datasource';
import PromQlLanguageProvider from '../../../language_provider';
import { EmptyLanguageProviderMock } from '../../../language_provider.mock';
import { PromOptions } from '../../../types';
import { PromVisualQuery } from '../../types';

import { MetricsModal, testIds } from './MetricsModal';

// don't care about interaction tracking in our unit tests
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

describe('MetricsModal', () => {
  it('renders the modal', async () => {
    setup(defaultQuery, listOfMetrics);
    await waitFor(() => {
      expect(screen.getByText('Metrics explorer')).toBeInTheDocument();
    });
  });

  it('renders a list of metrics', async () => {
    setup(defaultQuery, listOfMetrics);
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

    setup(query, ['with-labels'], true);
    await waitFor(() => {
      expect(screen.getByText('with-labels')).toBeInTheDocument();
    });
  });

  it('displays a type for a metric when the metric is clicked', async () => {
    setup(defaultQuery, listOfMetrics);
    await waitFor(() => {
      expect(screen.getByText('all-metrics')).toBeInTheDocument();
    });

    const interactiveMetric = screen.getByText('all-metrics');

    await userEvent.click(interactiveMetric);

    expect(screen.getByText('all-metrics-type')).toBeInTheDocument();
  });

  it('displays a description for a metric', async () => {
    setup(defaultQuery, listOfMetrics);
    await waitFor(() => {
      expect(screen.getByText('all-metrics')).toBeInTheDocument();
    });

    const interactiveMetric = screen.getByText('all-metrics');

    await userEvent.click(interactiveMetric);

    expect(screen.getByText('all-metrics-help')).toBeInTheDocument();
  });

  // Filtering
  it('has a filter for selected type', async () => {
    setup(defaultQuery, listOfMetrics);

    await waitFor(() => {
      const selectType = screen.getByText('Filter by type');
      expect(selectType).toBeInTheDocument();
    });
  });

  // Pagination
  it('shows metrics within a range by pagination', async () => {
    // default resultsPerPage is 100
    setup(defaultQuery, listOfMetrics);
    await waitFor(() => {
      expect(screen.getByText('all-metrics')).toBeInTheDocument();
      expect(screen.getByText('a_bucket')).toBeInTheDocument();
      expect(screen.getByText('a')).toBeInTheDocument();
      expect(screen.getByText('b')).toBeInTheDocument();
      expect(screen.getByText('c')).toBeInTheDocument();
      expect(screen.getByText('d')).toBeInTheDocument();
      expect(screen.getByText('e')).toBeInTheDocument();
      expect(screen.getByText('f')).toBeInTheDocument();
      expect(screen.getByText('g')).toBeInTheDocument();
      expect(screen.getByText('h')).toBeInTheDocument();
    });
  });

  it('does not show metrics outside a range by pagination', async () => {
    // default resultsPerPage is 10
    setup(defaultQuery, listOfMetrics);
    await waitFor(() => {
      const metricOutsideRange = screen.queryByText('j');
      expect(metricOutsideRange).toBeNull();
    });
  });

  it('shows results metrics per page chosen by the user', async () => {
    setup(defaultQuery, listOfMetrics);
    const resultsPerPageInput = screen.getByTestId(testIds.resultsPerPage);
    await userEvent.type(resultsPerPageInput, '12');
    const metricInsideRange = screen.getByText('j');
    expect(metricInsideRange).toBeInTheDocument();
  });

  it('paginates lots of metrics and does not run out of memory', async () => {
    const lotsOfMetrics: string[] = [...Array(100000).keys()].map((i) => '' + i);
    setup(defaultQuery, lotsOfMetrics);
    await waitFor(() => {
      // doesn't break on loading
      expect(screen.getByText('0')).toBeInTheDocument();
    });
    const resultsPerPageInput = screen.getByTestId(testIds.resultsPerPage);
    // doesn't break on changing results per page
    await userEvent.type(resultsPerPageInput, '11');
    const metricInsideRange = screen.getByText('9');
    expect(metricInsideRange).toBeInTheDocument();
  });

  // Fuzzy search
  it('searches and filter by metric name with a fuzzy search', async () => {
    // search for a_bucket by name
    setup(defaultQuery, listOfMetrics);
    let metricAll: HTMLElement | null;
    let metricABucket: HTMLElement | null;
    await waitFor(() => {
      metricAll = screen.getByText('all-metrics');
      metricABucket = screen.getByText('a_bucket');
      expect(metricAll).toBeInTheDocument();
      expect(metricABucket).toBeInTheDocument();
    });
    const searchMetric = screen.getByTestId(testIds.searchMetric);
    expect(searchMetric).toBeInTheDocument();
    await userEvent.type(searchMetric, 'a_buck');

    await waitFor(() => {
      metricAll = screen.queryByText('all-metrics');
      expect(metricAll).toBeNull();
    });
  });

  it('searches by name and description with a fuzzy search when setting is turned on', async () => {
    // search for a_bucket by metadata type counter but only type countt
    setup(defaultQuery, listOfMetrics);
    let metricABucket: HTMLElement | null;

    await waitFor(() => {
      metricABucket = screen.getByText('a_bucket');
      expect(metricABucket).toBeInTheDocument();
    });

    const showSettingsButton = screen.getByTestId(testIds.showAdditionalSettings);
    expect(showSettingsButton).toBeInTheDocument();
    await userEvent.click(showSettingsButton);

    const metadataSwitch = screen.getByTestId(testIds.searchWithMetadata);
    expect(metadataSwitch).toBeInTheDocument();
    await userEvent.click(metadataSwitch);

    const searchMetric = screen.getByTestId(testIds.searchMetric);
    expect(searchMetric).toBeInTheDocument();
    await userEvent.type(searchMetric, 'functions');

    await waitFor(() => {
      metricABucket = screen.getByText('a_bucket');
      expect(metricABucket).toBeInTheDocument();
    });
  });
});

const defaultQuery: PromVisualQuery = {
  metric: 'random_metric',
  labels: [],
  operations: [],
};

const listOfMetrics: string[] = ['all-metrics', 'a_bucket', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

function createDatasource(withLabels?: boolean) {
  const languageProvider = new EmptyLanguageProviderMock() as unknown as PromQlLanguageProvider;

  // display different results if their are labels selected in the PromVisualQuery
  if (withLabels) {
    languageProvider.metricsMetadata = {
      'with-labels': {
        type: 'with-labels-type',
        help: 'with-labels-help',
      },
    };
  } else {
    // all metrics
    languageProvider.metricsMetadata = {
      'all-metrics': {
        type: 'all-metrics-type',
        help: 'all-metrics-help',
      },
      a: {
        type: 'counter',
        help: 'a-metric-help',
      },
      a_bucket: {
        type: 'counter',
        help: 'for functions',
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

function createProps(query: PromVisualQuery, datasource: PrometheusDatasource, metrics: string[]) {
  return {
    datasource,
    isOpen: true,
    onChange: jest.fn(),
    onClose: jest.fn(),
    query: query,
    initialMetrics: metrics,
  };
}

function setup(query: PromVisualQuery, metrics: string[], withlabels?: boolean) {
  const withLabels: boolean = query.labels.length > 0;
  const datasource = createDatasource(withLabels);
  const props = createProps(query, datasource, metrics);

  // render the modal only
  const { container } = render(<MetricsModal {...props} />);

  return container;
}

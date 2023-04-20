import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';

import { PrometheusDatasource } from '../../../datasource';
import PromQlLanguageProvider from '../../../language_provider';
import { EmptyLanguageProviderMock } from '../../../language_provider.mock';
import { PromOptions } from '../../../types';
import { PromVisualQuery } from '../../types';

import { MetricEncyclopediaModal, testIds } from './MetricEncyclopediaModal';

// don't care about interaction tracking in our unit tests
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

describe('MetricEncyclopediaModal', () => {
  it('renders the modal', async () => {
    setup(defaultQuery, listOfMetrics);
    await waitFor(() => {
      expect(screen.getByText('Browse metrics')).toBeInTheDocument();
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

    setup(query, listOfMetrics);
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

  it('filters by alphebetical letter choice', async () => {
    setup(defaultQuery, listOfMetrics);
    // pick the letter J
    const letterJ = screen.getByTestId('letter-J');
    await userEvent.click(letterJ);

    // check metrics that start with J
    const metricStartingWithJ = screen.getByText('j');
    expect(metricStartingWithJ).toBeInTheDocument();
    // check metrics that don't start with J
    const metricStartingWithSomethingElse = screen.queryByText('a');
    expect(metricStartingWithSomethingElse).toBeNull();
  });

  it('allows a user to select a template variable', async () => {
    setup(defaultQuery, listOfMetrics);

    await waitFor(() => {
      const selectType = screen.getByText('Select template variables');
      expect(selectType).toBeInTheDocument();
    });
  });

  // Pagination
  it('shows metrics within a range by pagination', async () => {
    // default resultsPerPage is 10
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

  it('paginates millions of metrics and does not run out of memory', async () => {
    const millionsOfMetrics: string[] = [...Array(1000000).keys()].map((i) => '' + i);
    setup(defaultQuery, millionsOfMetrics);
    await waitFor(() => {
      // doesn't break on loading
      expect(screen.getByText('0')).toBeInTheDocument();
    });
    const resultsPerPageInput = screen.getByTestId(testIds.resultsPerPage);
    // doesn't break on changing results per page
    await userEvent.type(resultsPerPageInput, '11');
    const metricInsideRange = screen.getByText('10');
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
    await userEvent.type(searchMetric, 'a_b');

    await waitFor(() => {
      metricABucket = screen.getByText('a_bucket');
      expect(metricABucket).toBeInTheDocument();
      metricAll = screen.queryByText('all-metrics');
      expect(metricAll).toBeNull();
    });
  });

  it('searches by all metric metadata with a fuzzy search', async () => {
    // search for a_bucket by metadata type counter but only type countt
    setup(defaultQuery, listOfMetrics);
    let metricABucket: HTMLElement | null;

    await waitFor(() => {
      metricABucket = screen.getByText('a_bucket');
      expect(metricABucket).toBeInTheDocument();
    });

    const metadataSwitch = screen.getByTestId(testIds.searchWithMetadata);
    expect(metadataSwitch).toBeInTheDocument();
    await userEvent.click(metadataSwitch);

    const searchMetric = screen.getByTestId(testIds.searchMetric);
    expect(searchMetric).toBeInTheDocument();
    await userEvent.type(searchMetric, 'countt');

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

function createDatasource(metrics: string[], withLabels?: boolean) {
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
    languageProvider.getLabelValues = () => Promise.resolve(metrics);
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

function createProps(query: PromVisualQuery, datasource: PrometheusDatasource) {
  return {
    datasource,
    isOpen: true,
    onChange: jest.fn(),
    onClose: jest.fn(),
    query: query,
  };
}

function setup(query: PromVisualQuery, metrics: string[], withlabels?: boolean) {
  const withLabels: boolean = query.labels.length > 0;
  const datasource = createDatasource(metrics, withLabels);
  const props = createProps(query, datasource);

  // render the modal only
  const { container } = render(<MetricEncyclopediaModal {...props} />);

  return container;
}

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

describe('MetricEncyclopediaModal', () => {
  it('renders the modal', async () => {
    setup(defaultQuery, listOfMetrics);
    await waitFor(() => {
      expect(screen.getByText('Select Metric')).toBeInTheDocument();
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

  it('displays no metadata for a metric missing metadata when the metric is clicked', async () => {
    setup(defaultQuery, listOfMetrics);
    await waitFor(() => {
      expect(screen.getByText('b')).toBeInTheDocument();
    });

    const interactiveMetric = screen.getByText('b');

    await userEvent.click(interactiveMetric);

    expect(screen.getByText('No metadata available')).toBeInTheDocument();
  });

  // Pagination
  it('shows metrics within a range by pagination', async () => {
    // default resultsPerPage is 10
    setup(defaultQuery, listOfMetrics);
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
    setup(defaultQuery, listOfMetrics);
    await waitFor(() => {
      const metricOutsideRange = screen.queryByText('j');
      expect(metricOutsideRange).toBeNull();
    });
  });

  it('shows results metrics per page chosen by the user', async () => {
    setup(defaultQuery, listOfMetrics);
    const resultsPerPageInput = screen.getByTestId('results-per-page');
    await userEvent.type(resultsPerPageInput, '11');
    const metricInsideRange = screen.getByText('j');
    expect(metricInsideRange).toBeInTheDocument();
  });

  it('paginates millions of metrics and doee not run out of memory', async () => {
    // 10 million metrics!!! HA HA HA HA! :)
    const millionsOfMetrics: string[] = [...Array(10000000).keys()].map((i) => '' + i);
    setup(defaultQuery, millionsOfMetrics);
    await waitFor(() => {
      // doesn't break on loading
      expect(screen.getByText('0')).toBeInTheDocument();
    });
    const resultsPerPageInput = screen.getByTestId('results-per-page');
    // doesn't break on changing results per page
    await userEvent.type(resultsPerPageInput, '11');
    const metricInsideRange = screen.getByText('10');
    expect(metricInsideRange).toBeInTheDocument();
  });

  // // Filtering
  // it('filters results based on selected type', async () => {
  //   // default resultsPerPage is 10
  //   setup(defaultQuery, listOfMetrics);
  //   // how do you test the MultiSelect?
  //   // this does not work
  //   // https://developers.grafana.com/ui/latest/index.html?path=/docs/forms-select--multi-select-basic

  // });

  // it('sorts alphabetically but puts metrics with no metadata last', async () => {
  //   // default resultsPerPage is 10
  //   setup(defaultQuery, listOfMetrics);
  //   // how do you test the MultiSelect?
  //   // this does not work
  //   // https://developers.grafana.com/ui/latest/index.html?path=/docs/forms-select--multi-select-basic

  // });

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
});

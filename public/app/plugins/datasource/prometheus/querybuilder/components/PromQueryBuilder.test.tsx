import { getByText, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {
  DataSourceInstanceSettings,
  DataSourcePluginMeta,
  LoadingState,
  MutableDataFrame,
  PanelData,
  TimeRange,
} from '@grafana/data';

import { PromApplication } from '../../../../../types/unified-alerting-dto';
import { PrometheusDatasource } from '../../datasource';
import PromQlLanguageProvider from '../../language_provider';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';
import { PromOptions } from '../../types';
import { getLabelSelects } from '../testUtils';
import { PromVisualQuery } from '../types';

import { PromQueryBuilder } from './PromQueryBuilder';
import { EXPLAIN_LABEL_FILTER_CONTENT } from './PromQueryBuilderExplained';

const defaultQuery: PromVisualQuery = {
  metric: 'random_metric',
  labels: [],
  operations: [],
};

const bugQuery: PromVisualQuery = {
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
  binaryQueries: [
    {
      operator: '/',
      query: {
        metric: 'metric2',
        labels: [{ label: 'foo', op: '=', value: 'bar' }],
        operations: [
          {
            id: '__avg_by',
            params: ['app'],
          },
        ],
      },
    },
  ],
};

describe('PromQueryBuilder', () => {
  it('shows empty just with metric selected', async () => {
    setup();
    // Add label
    expect(screen.getByLabelText('Add')).toBeInTheDocument();
    expect(screen.getByTitle('Add operation')).toBeInTheDocument();
  });

  it('renders all the query sections', async () => {
    setup(bugQuery);
    expect(screen.getByText('random_metric')).toBeInTheDocument();
    expect(screen.getByText('localhost:9090')).toBeInTheDocument();
    expect(screen.getByText('Rate')).toBeInTheDocument();
    const sumBys = screen.getAllByTestId('operations.1.wrapper');
    expect(getByText(sumBys[0], 'instance')).toBeInTheDocument();
    expect(getByText(sumBys[0], 'job')).toBeInTheDocument();

    const avgBys = screen.getAllByTestId('operations.0.wrapper');
    expect(getByText(avgBys[1], 'app')).toBeInTheDocument();
    expect(screen.getByText('Operator')).toBeInTheDocument();
    expect(screen.getByText('Vector matches')).toBeInTheDocument();
  });

  it('tries to load metrics without labels', async () => {
    const { languageProvider, container } = setup();
    await openMetricSelect(container);
    await waitFor(() => expect(languageProvider.getLabelValues).toBeCalledWith('__name__'));
  });

  it('tries to load metrics with labels', async () => {
    const { languageProvider, container } = setup({
      ...defaultQuery,
      labels: [{ label: 'label_name', op: '=', value: 'label_value' }],
    });
    await openMetricSelect(container);
    await waitFor(() => expect(languageProvider.getSeries).toBeCalledWith('{label_name="label_value"}', true));
  });

  it('tries to load variables in metric field', async () => {
    const { datasource, container } = setup();
    datasource.getVariables = jest.fn().mockReturnValue([]);
    await openMetricSelect(container);
    await waitFor(() => expect(datasource.getVariables).toBeCalled());
  });

  // <LegacyPrometheus>
  it('tries to load labels when metric selected', async () => {
    const { languageProvider } = setup();
    await openLabelNameSelect();
    await waitFor(() => expect(languageProvider.fetchSeriesLabels).toBeCalledWith('{__name__="random_metric"}'));
  });

  it('tries to load variables in label field', async () => {
    const { datasource } = setup();
    datasource.getVariables = jest.fn().mockReturnValue([]);
    await openLabelNameSelect();
    await waitFor(() => expect(datasource.getVariables).toBeCalled());
  });

  it('tries to load labels when metric selected and other labels are already present', async () => {
    const { languageProvider } = setup({
      ...defaultQuery,
      labels: [
        { label: 'label_name', op: '=', value: 'label_value' },
        { label: 'foo', op: '=', value: 'bar' },
      ],
    });
    await openLabelNameSelect(1);
    await waitFor(() =>
      expect(languageProvider.fetchSeriesLabels).toBeCalledWith('{label_name="label_value", __name__="random_metric"}')
    );
  });
  //</LegacyPrometheus>

  it('tries to load labels when metric is not selected', async () => {
    const { languageProvider } = setup({
      ...defaultQuery,
      metric: '',
    });
    await openLabelNameSelect();
    await waitFor(() => expect(languageProvider.fetchLabels).toBeCalled());
  });

  it('shows hints for histogram metrics', async () => {
    const { container } = setup({
      metric: 'histogram_metric_bucket',
      labels: [],
      operations: [],
    });
    await openMetricSelect(container);
    await userEvent.click(screen.getByText('histogram_metric_bucket'));
    await waitFor(() => expect(screen.getByText('hint: add histogram_quantile')).toBeInTheDocument());
  });

  it('shows hints for counter metrics', async () => {
    const { container } = setup({
      metric: 'histogram_metric_sum',
      labels: [],
      operations: [],
    });
    await openMetricSelect(container);
    await userEvent.click(screen.getByText('histogram_metric_sum'));
    await waitFor(() => expect(screen.getByText('hint: add rate')).toBeInTheDocument());
  });

  it('shows hints for counter metrics', async () => {
    const { container } = setup({
      metric: 'histogram_metric_sum',
      labels: [],
      operations: [],
    });
    await openMetricSelect(container);
    await userEvent.click(screen.getByText('histogram_metric_sum'));
    await waitFor(() => expect(screen.getByText('hint: add rate')).toBeInTheDocument());
  });

  it('shows multiple hints', async () => {
    const data: PanelData = {
      series: [],
      state: LoadingState.Done,
      timeRange: {} as TimeRange,
    };
    for (let i = 0; i < 25; i++) {
      data.series.push(new MutableDataFrame());
    }
    const { container } = setup(
      {
        metric: 'histogram_metric_sum',
        labels: [],
        operations: [],
      },
      data
    );
    await openMetricSelect(container);
    await userEvent.click(screen.getByText('histogram_metric_sum'));
    await waitFor(() => expect(screen.getAllByText(/hint:/)).toHaveLength(2));
  });

  it('shows explain section when showExplain is true', async () => {
    const { datasource } = createDatasource();
    const props = createProps(datasource);
    props.showExplain = true;
    render(
      <PromQueryBuilder
        {...props}
        query={{
          metric: 'histogram_metric_sum',
          labels: [],
          operations: [],
        }}
      />
    );
    expect(await screen.findByText(EXPLAIN_LABEL_FILTER_CONTENT)).toBeInTheDocument();
  });

  it('does not show explain section when showExplain is false', async () => {
    const { datasource } = createDatasource();
    const props = createProps(datasource);
    render(
      <PromQueryBuilder
        {...props}
        query={{
          metric: 'histogram_metric_sum',
          labels: [],
          operations: [],
        }}
      />
    );
    expect(await screen.queryByText(EXPLAIN_LABEL_FILTER_CONTENT)).not.toBeInTheDocument();
  });

  // <ModernPrometheus>
  it('tries to load labels when metric selected modern prom', async () => {
    const { languageProvider } = setup(undefined, undefined, {
      jsonData: { prometheusVersion: '2.38.1', prometheusType: PromApplication.Prometheus },
    });
    await openLabelNameSelect();
    await waitFor(() => expect(languageProvider.fetchSeriesLabelsMatch).toBeCalledWith('{__name__="random_metric"}'));
  });

  it('tries to load variables in label field modern prom', async () => {
    const { datasource } = setup(undefined, undefined, {
      jsonData: { prometheusVersion: '2.38.1', prometheusType: PromApplication.Prometheus },
    });
    datasource.getVariables = jest.fn().mockReturnValue([]);
    await openLabelNameSelect();
    await waitFor(() => expect(datasource.getVariables).toBeCalled());
  });

  it('tries to load labels when metric selected and other labels are already present modern prom', async () => {
    const { languageProvider } = setup(
      {
        ...defaultQuery,
        labels: [
          { label: 'label_name', op: '=', value: 'label_value' },
          { label: 'foo', op: '=', value: 'bar' },
        ],
      },
      undefined,
      { jsonData: { prometheusVersion: '2.38.1', prometheusType: PromApplication.Prometheus } }
    );
    await openLabelNameSelect(1);
    await waitFor(() =>
      expect(languageProvider.fetchSeriesLabelsMatch).toBeCalledWith(
        '{label_name="label_value", __name__="random_metric"}'
      )
    );
  });
  //</ModernPrometheus>
});

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
  return { datasource, languageProvider };
}

function createProps(datasource: PrometheusDatasource, data?: PanelData) {
  return {
    datasource,
    onRunQuery: () => {},
    onChange: () => {},
    data,
    showExplain: false,
  };
}

function setup(
  query: PromVisualQuery = defaultQuery,
  data?: PanelData,
  datasourceOptionsOverride?: Partial<DataSourceInstanceSettings<PromOptions>>
) {
  const { datasource, languageProvider } = createDatasource(datasourceOptionsOverride);
  const props = createProps(datasource, data);
  const { container } = render(<PromQueryBuilder {...props} query={query} />);
  return { languageProvider, datasource, container };
}

async function openMetricSelect(container: HTMLElement) {
  const select = container.querySelector('#prometheus-metric-select');
  if (select) {
    await userEvent.click(select);
  }
}

async function openLabelNameSelect(index = 0) {
  const { name } = getLabelSelects(index);
  await userEvent.click(name);
}

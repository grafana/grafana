// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/shared/OperationList.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataSourceApi, type DataSourceInstanceSettings } from '@grafana/data';

import { PrometheusDatasource } from '../../datasource';
import { type PrometheusLanguageProviderInterface } from '../../language_provider';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';
import { getMockTimeRange } from '../../test/mocks/datasource';
import { type PromOptions } from '../../types';
import { addOperationInQueryBuilder } from '../testUtils';
import { type PromVisualQuery } from '../types';

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

  it('associates each param label with its input so screen readers announce it', () => {
    // Regression for https://github.com/grafana/grafana/issues/66347 — the <label>
    // used a useId-derived id while the editors used operation.id, so every param
    // label was an orphan and Prometheus query builder fields had no accessible name.
    setup();
    // Rate has a Range param — the label "Range" must be linked to its combo box input.
    expect(screen.getByLabelText('Range').tagName).toBe('INPUT');
  });

  it('gives each instance of a duplicated operation a distinct input id', () => {
    // The id includes the operation's index so two `rate` operations don't
    // produce duplicate `operations.rate.param.0` ids (which would confuse
    // screen readers and collide in the DOM).
    setup({
      metric: 'random_metric',
      labels: [{ label: 'instance', op: '=', value: 'localhost:9090' }],
      operations: [
        { id: 'rate', params: ['auto'] },
        { id: 'rate', params: ['$__rate_interval'] },
      ],
    });
    const rangeInputs = screen.getAllByLabelText('Range');
    expect(rangeInputs).toHaveLength(2);
    expect(rangeInputs[0].id).not.toBe(rangeInputs[1].id);
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

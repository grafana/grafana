// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/PromQueryBuilderContainer.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';

import { PrometheusDatasource } from '../../datasource';
import { PrometheusLanguageProviderInterface } from '../../language_provider';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';
import { PromQuery } from '../../types';
import { getOperationParamId } from '../shared/param_utils';
import { addOperationInQueryBuilder } from '../testUtils';

import { PromQueryBuilderContainer } from './PromQueryBuilderContainer';

describe('PromQueryBuilderContainer', () => {
  it('translates query between string and model', async () => {
    const { props } = setup({ expr: 'rate(metric_test{job="testjob"}[$__rate_interval])' });

    await addOperationInQueryBuilder('Range functions', 'Rate');
    // extra fields here are for storing metrics explorer settings. Future work: store these in local storage.
    expect(props.onChange).toHaveBeenCalledWith({
      disableTextWrap: false,
      expr: 'rate(metric_test{job="testjob"}[$__rate_interval])',
      fullMetaSearch: false,
      includeNullMetadata: true,
      refId: 'A',
      useBackend: false,
    });
  });

  it('Can add rest param', async () => {
    const { container } = setup({ expr: 'sum(ALERTS)' });
    await userEvent.click(screen.getByTestId('operations.0.add-rest-param'));

    waitFor(() => {
      expect(container.querySelector(`${getOperationParamId('0', 0)}`)).toBeInTheDocument();
    });
  });
});

function setup(queryOverrides: Partial<PromQuery> = {}) {
  const languageProvider = new EmptyLanguageProviderMock() as unknown as PrometheusLanguageProviderInterface;
  const datasource = new PrometheusDatasource(
    {
      url: '',
      jsonData: {},
      meta: {} as DataSourcePluginMeta,
    } as DataSourceInstanceSettings,
    undefined,
    languageProvider
  );

  const props = {
    datasource,
    query: {
      refId: 'A',
      expr: '',
      ...queryOverrides,
    },
    onRunQuery: jest.fn(),
    onChange: jest.fn(),
    showExplain: false,
  };

  const { container } = render(<PromQueryBuilderContainer {...props} />);
  return { languageProvider, datasource, container, props };
}

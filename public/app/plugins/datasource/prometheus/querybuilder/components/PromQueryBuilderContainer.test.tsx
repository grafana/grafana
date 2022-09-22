import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { PrometheusDatasource } from '../../datasource';
import PromQlLanguageProvider from '../../language_provider';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';
import { PromQuery } from '../../types';
import { addOperation } from '../shared/OperationList.testUtils';
import { getOperationParamId } from '../shared/operationUtils';

import { PromQueryBuilderContainer } from './PromQueryBuilderContainer';

describe('PromQueryBuilderContainer', () => {
  it('translates query between string and model', async () => {
    const { props } = setup({ expr: 'rate(metric_test{job="testjob"}[$__rate_interval])' });

    expect(screen.getByText('metric_test')).toBeInTheDocument();
    await addOperation('Range functions', 'Rate');
    expect(props.onChange).toBeCalledWith({
      expr: 'rate(metric_test{job="testjob"}[$__rate_interval])',
      refId: 'A',
    });
  });

  it('Can add rest param', async () => {
    const { container } = setup({ expr: 'sum(ALERTS)' });
    await userEvent.click(screen.getByTestId('operations.0.add-rest-param'));

    waitFor(() => {
      expect(container.querySelector(`${getOperationParamId(0, 0)}`)).toBeInTheDocument();
    });
  });
});

function setup(queryOverrides: Partial<PromQuery> = {}) {
  const languageProvider = new EmptyLanguageProviderMock() as unknown as PromQlLanguageProvider;
  const datasource = new PrometheusDatasource(
    {
      url: '',
      jsonData: {},
      meta: {} as any,
    } as any,
    undefined,
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

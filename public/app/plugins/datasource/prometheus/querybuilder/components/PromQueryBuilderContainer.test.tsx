import React from 'react';
import { render, screen } from '@testing-library/react';
import { PromQueryBuilderContainer } from './PromQueryBuilderContainer';
import { PrometheusDatasource } from '../../datasource';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';
import PromQlLanguageProvider from '../../language_provider';
import { addOperation } from '../shared/OperationList.testUtils';

describe('PromQueryBuilderContainer', () => {
  it('translates query between string and model', async () => {
    const props = {
      query: {
        expr: 'metric_test{job="testjob"}',
        refId: 'A',
      },
      datasource: new PrometheusDatasource(
        {
          id: 1,
          uid: '',
          type: 'prometheus',
          name: 'prom-test',
          access: 'proxy',
          url: '',
          jsonData: {},
          meta: {} as any,
        },
        undefined,
        undefined,
        new EmptyLanguageProviderMock() as unknown as PromQlLanguageProvider
      ),
      onChange: jest.fn(),
      onRunQuery: () => {},
    };
    render(<PromQueryBuilderContainer {...props} />);
    expect(screen.getByText('metric_test')).toBeInTheDocument();
    addOperation('Range functions', 'Rate');
    expect(props.onChange).toBeCalledWith({
      expr: 'rate(metric_test{job="testjob"}[$__rate_interval])',
      refId: 'A',
    });
  });
});

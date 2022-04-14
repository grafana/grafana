import React from 'react';
import { render, screen } from '@testing-library/react';
import { LokiQueryBuilderContainer } from './LokiQueryBuilderContainer';
import { LokiDatasource } from '../../datasource';
import { addOperation } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationList.testUtils';

describe('LokiQueryBuilderContainer', () => {
  it('translates query between string and model', async () => {
    const props = {
      query: {
        expr: '{job="testjob"}',
        refId: 'A',
      },
      datasource: new LokiDatasource(
        {
          id: 1,
          uid: '',
          type: 'loki',
          name: 'loki-test',
          access: 'proxy',
          url: '',
          jsonData: {},
          meta: {} as any,
        },
        undefined,
        undefined
      ),
      onChange: jest.fn(),
      onRunQuery: () => {},
    };
    render(<LokiQueryBuilderContainer {...props} />);
    expect(screen.getByText('testjob')).toBeInTheDocument();
    addOperation('Range functions', 'Rate');
    expect(props.onChange).toBeCalledWith({
      expr: 'rate({job="testjob"} [$__interval])',
      refId: 'A',
    });
  });
});

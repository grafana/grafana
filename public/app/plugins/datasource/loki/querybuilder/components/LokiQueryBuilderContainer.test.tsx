import { render, screen } from '@testing-library/react';
import React from 'react';

import { addOperation } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationList.testUtils';

import { createLokiDatasource } from '../../mocks';

import { LokiQueryBuilderContainer } from './LokiQueryBuilderContainer';

describe('LokiQueryBuilderContainer', () => {
  it('translates query between string and model', async () => {
    const props = {
      query: {
        expr: '{job="testjob"}',
        refId: 'A',
      },
      datasource: createLokiDatasource(),
      onChange: jest.fn(),
      onRunQuery: () => {},
      showExplain: false,
    };
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);

    render(<LokiQueryBuilderContainer {...props} />);
    const selector = await screen.findByLabelText('selector');
    expect(selector.textContent).toBe('{job="testjob"}');
    await addOperation('Range functions', 'Rate');
    expect(await screen.findByText('Rate')).toBeInTheDocument();
    expect(props.onChange).toBeCalledWith({
      expr: 'rate({job="testjob"} [$__auto])',
      refId: 'A',
    });
  });
});

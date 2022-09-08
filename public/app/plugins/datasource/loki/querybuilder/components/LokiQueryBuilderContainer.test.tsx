import { render, screen } from '@testing-library/react';
import React from 'react';

import { DataSourcePluginMeta } from '@grafana/data';
import { addOperation } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationList.testUtils';

import { LokiDatasource } from '../../datasource';

import { LokiQueryBuilderContainer } from './LokiQueryBuilderContainer';

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
          meta: {} as DataSourcePluginMeta,
          readOnly: false,
        },
        undefined,
        undefined
      ),
      onChange: jest.fn(),
      onRunQuery: () => {},
      showRawQuery: true,
      showExplain: false,
    };
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);

    render(<LokiQueryBuilderContainer {...props} />);
    const selector = await screen.findByLabelText('selector');
    expect(selector.textContent).toBe('{job="testjob"}');
    await addOperation('Range functions', 'Rate');
    expect(await screen.findByText('Rate')).toBeInTheDocument();
    expect(props.onChange).toBeCalledWith({
      expr: 'rate({job="testjob"} [$__interval])',
      refId: 'A',
    });
  });
});

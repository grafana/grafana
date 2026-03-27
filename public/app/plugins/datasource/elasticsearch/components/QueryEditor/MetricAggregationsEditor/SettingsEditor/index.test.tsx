import { fireEvent, render, screen } from '@testing-library/react';

import { getDefaultTimeRange } from '@grafana/data';

import { type ElasticsearchDataQuery } from '../../../../dataquery.gen';
import { type ElasticDatasource } from '../../../../datasource';
import { ElasticsearchProvider } from '../../ElasticsearchQueryContext';
import { ElasticsearchQueryOptions } from '../../ElasticsearchQueryOptions';

import { SettingsEditor } from '.';

describe('Settings Editor', () => {
  describe('Raw Data', () => {
    it('Should correctly render the options and trigger correct state changes', () => {
      const metricId = '1';
      const initialSize = '500';
      const query: ElasticsearchDataQuery = {
        refId: 'A',
        query: '',
        metrics: [
          {
            id: metricId,
            type: 'raw_data',
            settings: {
              size: initialSize,
            },
          },
        ],
        bucketAggs: [],
      };

      const onChange = jest.fn();

      render(
        <ElasticsearchProvider
          query={query}
          datasource={{} as ElasticDatasource}
          onChange={onChange}
          onRunQuery={() => {}}
          range={getDefaultTimeRange()}
        >
          <ElasticsearchQueryOptions />
        </ElasticsearchProvider>
      );

      // The options group should be collapsed showing the current size
      const optionsButton = screen.getByRole('button', { name: /Options/i });
      expect(optionsButton).toBeInTheDocument();

      // Open the options group
      fireEvent.click(optionsButton);

      // The options should have a Size input
      const sizeInputEl = screen.getByLabelText('Size');
      expect(sizeInputEl).toBeInTheDocument();

      // Change the value and blur to trigger dispatch
      const newSizeValue = '23';
      fireEvent.change(sizeInputEl, { target: { value: newSizeValue } });
      fireEvent.blur(sizeInputEl, { target: { value: newSizeValue } });

      // the onChange handler should have been called correctly
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].metrics![0].settings?.size).toBe(newSizeValue);
    });
  });

  describe('Rate aggregation', () => {
    it('should render correct settings', () => {
      const metricId = '1';
      const query: ElasticsearchDataQuery = {
        refId: 'A',
        query: '',
        metrics: [
          {
            id: metricId,
            type: 'rate',
            settings: {},
          },
        ],
        bucketAggs: [],
      };

      const onChange = jest.fn();

      render(
        <ElasticsearchProvider
          query={query}
          datasource={{} as ElasticDatasource}
          onChange={onChange}
          onRunQuery={() => {}}
          range={getDefaultTimeRange()}
        >
          <SettingsEditor metric={query.metrics![0]} previousMetrics={[]} />
        </ElasticsearchProvider>
      );

      let settingsButtonEl = screen.getByRole('button');
      fireEvent.click(settingsButtonEl);

      const unitSelectElement = screen.getByTestId('unit-select');
      const modeSelectElement = screen.getByTestId('mode-select');

      expect(unitSelectElement).toBeInTheDocument();
      expect(modeSelectElement).toBeInTheDocument();
    });
  });
});

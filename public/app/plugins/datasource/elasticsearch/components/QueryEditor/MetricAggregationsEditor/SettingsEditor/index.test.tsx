import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { getDefaultTimeRange } from '@grafana/data';

import { ElasticDatasource } from '../../../../datasource';
import { ElasticsearchQuery } from '../../../../types';
import { ElasticsearchProvider } from '../../ElasticsearchQueryContext';

import { SettingsEditor } from '.';

describe('Settings Editor', () => {
  describe('Raw Data', () => {
    it('Should correctly render the settings editor and trigger correct state changes', () => {
      const metricId = '1';
      const initialSize = '500';
      const query: ElasticsearchQuery = {
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

      const { rerender } = render(
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

      let settingsButtonEl = screen.getByRole('button', {
        name: /Size: \d+$/i,
      });

      // The metric row should have a settings button
      expect(settingsButtonEl).toBeInTheDocument();
      expect(settingsButtonEl.textContent).toBe(`Size: ${initialSize}`);

      // Open the settings editor
      fireEvent.click(settingsButtonEl);

      // The settings editor should have a Size input
      const sizeInputEl = screen.getByLabelText('Size');
      expect(sizeInputEl).toBeInTheDocument();

      // We change value and trigger a blur event to trigger an update
      const newSizeValue = '23';
      fireEvent.change(sizeInputEl, { target: { value: newSizeValue } });
      fireEvent.blur(sizeInputEl);

      // the onChange handler should have been called correctly, and the resulting
      // query state should match what expected
      expect(onChange).toHaveBeenCalledTimes(1);
      rerender(
        <ElasticsearchProvider
          query={onChange.mock.calls[0][0]}
          datasource={{} as ElasticDatasource}
          onChange={onChange}
          onRunQuery={() => {}}
          range={getDefaultTimeRange()}
        >
          <SettingsEditor metric={onChange.mock.calls[0][0].metrics![0]} previousMetrics={[]} />
        </ElasticsearchProvider>
      );

      settingsButtonEl = screen.getByRole('button', {
        name: /Size: \d+$/i,
      });
      expect(settingsButtonEl).toBeInTheDocument();
      expect(settingsButtonEl.textContent).toBe(`Size: ${newSizeValue}`);
    });
  });

  describe('Rate aggregation', () => {
    it('should render correct settings', () => {
      const metricId = '1';
      const query: ElasticsearchQuery = {
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

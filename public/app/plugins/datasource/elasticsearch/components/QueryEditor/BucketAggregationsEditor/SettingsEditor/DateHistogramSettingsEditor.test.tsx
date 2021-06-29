import { getDefaultTimeRange } from '@grafana/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ElasticDatasource } from 'app/plugins/datasource/elasticsearch/datasource';
import { ElasticsearchQuery } from 'app/plugins/datasource/elasticsearch/types';
import React, { ComponentProps, ReactNode } from 'react';
import { ElasticsearchProvider } from '../../ElasticsearchQueryContext';
import { DateHistogram } from '../aggregations';
import { DateHistogramSettingsEditor } from './DateHistogramSettingsEditor';

const renderWithESProvider = (
  ui: ReactNode,
  {
    providerProps: {
      datasource = {} as ElasticDatasource,
      query = { refId: 'A' },
      onChange = () => void 0,
      onRunQuery = () => void 0,
      range = getDefaultTimeRange(),
    } = {},
    ...renderOptions
  }: { providerProps?: Partial<Omit<ComponentProps<typeof ElasticsearchProvider>, 'children'>> } & Parameters<
    typeof render
  >[1]
) => {
  return render(
    <ElasticsearchProvider
      query={query}
      onChange={onChange}
      datasource={datasource}
      onRunQuery={onRunQuery}
      range={range}
    >
      {ui}
    </ElasticsearchProvider>,
    renderOptions
  );
};

describe('DateHistogram Settings Editor', () => {
  describe('Custom options for interval', () => {
    it('Allows users to create and select case sensitive custom options', () => {
      const bucketAgg: DateHistogram = {
        id: '1',
        type: 'date_histogram',
        settings: {
          interval: 'auto',
        },
      };

      const query: ElasticsearchQuery = {
        refId: 'A',
        bucketAggs: [bucketAgg],
        metrics: [{ id: '2', type: 'count' }],
        query: '',
      };

      const onChange = jest.fn();

      renderWithESProvider(<DateHistogramSettingsEditor bucketAgg={bucketAgg} />, {
        providerProps: { query, onChange },
      });

      const intervalInput = screen.getByLabelText('Interval') as HTMLInputElement;

      expect(intervalInput).toBeInTheDocument();
      expect(screen.getByText('auto')).toBeInTheDocument();

      // we open the menu
      userEvent.click(intervalInput);

      // default options don't have 1M but 1m
      expect(screen.queryByText('1M')).not.toBeInTheDocument();
      expect(screen.getByText('1m')).toBeInTheDocument();

      // we type in the input 1M, which should prompt an option creation
      userEvent.type(intervalInput, '1M');
      const creatableOption = screen.getByLabelText('Select option');
      expect(creatableOption).toHaveTextContent('Create: 1M');

      // we click on the creatable option to trigger its creation
      userEvent.click(creatableOption);

      expect(onChange).toHaveBeenCalled();

      // we open the menu again
      userEvent.click(intervalInput);
      // the created option should be available
      expect(screen.getByText('1M')).toBeInTheDocument();
    });
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { OpenTsdbQuery } from '../types';

import { FilterSection, FilterSectionProps, testIds } from './FilterSection';

const onRunQuery = jest.fn();
const onChange = jest.fn();

const setup = (propOverrides?: Object) => {
  const suggestTagKeys = jest.fn();
  const suggestTagValues = jest.fn();

  const query: OpenTsdbQuery = {
    metric: 'cpu',
    refId: 'A',
    downsampleAggregator: 'avg',
    downsampleFillPolicy: 'none',
    filters: [
      {
        filter: 'server1',
        groupBy: true,
        tagk: 'hostname',
        type: 'iliteral_or',
      },
    ],
  };

  const props: FilterSectionProps = {
    query,
    onChange: onChange,
    onRunQuery: onRunQuery,
    suggestTagKeys: suggestTagKeys,
    filterTypes: ['literal_or'],
    suggestTagValues: suggestTagValues,
  };

  Object.assign(props, propOverrides);

  return render(<FilterSection {...props} />);
};
describe('FilterSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render filter section', () => {
    setup();
    expect(screen.getByTestId(testIds.section)).toBeInTheDocument();
  });

  describe('filter editor', () => {
    it('open the editor on clicking +', () => {
      setup();
      fireEvent.click(screen.getByRole('button', { name: /Add filter/ }));
      expect(screen.getByText('Group by')).toBeInTheDocument();
    });

    it('should display a list of filters', () => {
      setup();
      expect(screen.getByTestId(testIds.list + '0')).toBeInTheDocument();
    });

    it('should call runQuery on adding a filter', () => {
      setup();
      fireEvent.click(screen.getByRole('button', { name: /Add filter/ }));
      fireEvent.click(screen.getByText('add filter'));
      expect(onRunQuery).toHaveBeenCalled();
    });

    it('should have an error if tags are present when adding a filter', () => {
      const query: OpenTsdbQuery = {
        metric: 'cpu',
        refId: 'A',
        downsampleAggregator: 'avg',
        downsampleFillPolicy: 'none',
        tags: [{}],
      };
      setup({ query });
      fireEvent.click(screen.getByRole('button', { name: /Add filter/ }));
      fireEvent.click(screen.getByText('add filter'));
      expect(screen.getByTestId(testIds.error)).toBeInTheDocument();
    });

    it('should remove a filter', () => {
      const query: OpenTsdbQuery = {
        metric: 'cpu',
        refId: 'A',
        downsampleAggregator: 'avg',
        downsampleFillPolicy: 'none',
        filters: [
          {
            filter: 'server1',
            groupBy: true,
            tagk: 'hostname',
            type: 'iliteral_or',
          },
        ],
      };

      setup({ query });
      fireEvent.click(screen.getByTestId(testIds.remove));
      expect(query.filters?.length === 0).toBeTruthy();
    });
  });
});

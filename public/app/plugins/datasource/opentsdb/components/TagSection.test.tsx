import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { OpenTsdbQuery } from '../types';

import { TagSection, TagSectionProps, testIds } from './TagSection';

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
    tags: {
      tagKey: 'tagValue',
    },
  };

  const props: TagSectionProps = {
    query,
    onChange: onChange,
    onRunQuery: onRunQuery,
    suggestTagKeys: suggestTagKeys,
    suggestTagValues: suggestTagValues,
    tsdbVersion: 2,
  };

  Object.assign(props, propOverrides);

  return render(<TagSection {...props} />);
};
describe('Tag Section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render tag section', () => {
    setup();
    expect(screen.getByTestId(testIds.section)).toBeInTheDocument();
  });

  describe('tag editor', () => {
    it('open the editor on clicking +', () => {
      setup();
      fireEvent.click(screen.getByRole('button', { name: /Add tag/ }));
      expect(screen.getByText('add tag')).toBeInTheDocument();
    });

    it('should display a list of tags', () => {
      setup();
      expect(screen.getByTestId(testIds.list + '0')).toBeInTheDocument();
    });

    it('should call runQuery on adding a tag', () => {
      setup();
      fireEvent.click(screen.getByRole('button', { name: /Add tag/ }));
      fireEvent.click(screen.getByText('add tag'));
      expect(onRunQuery).toHaveBeenCalled();
    });

    it('should have an error if filters are present when adding a tag', () => {
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
      fireEvent.click(screen.getByRole('button', { name: /Add tag/ }));
      fireEvent.click(screen.getByText('add tag'));
      expect(screen.getByTestId(testIds.error)).toBeInTheDocument();
    });

    it('should remove a tag', () => {
      const query: OpenTsdbQuery = {
        metric: 'cpu',
        refId: 'A',
        downsampleAggregator: 'avg',
        downsampleFillPolicy: 'none',
        tags: {
          tag: 'tagToRemove',
        },
      };

      setup({ query });
      fireEvent.click(screen.getByTestId(testIds.remove));
      expect(Object.keys(query.tags).length === 0).toBeTruthy();
    });
  });
});

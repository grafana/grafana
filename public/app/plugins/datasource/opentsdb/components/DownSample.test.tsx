import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { OpenTsdbQuery } from '../types';

import { DownSample, DownSampleProps, testIds } from './DownSample';

const onRunQuery = jest.fn();
const onChange = jest.fn();

const tsdbVersions = [
  { label: '<=2.1', value: 1 },
  { label: '==2.2', value: 2 },
  { label: '==2.3', value: 3 },
];

const setup = (tsdbVersion: number, propOverrides?: Object) => {
  const query: OpenTsdbQuery = {
    metric: '',
    refId: 'A',
    downsampleAggregator: 'avg',
    downsampleFillPolicy: 'none',
  };
  const props: DownSampleProps = {
    query,
    onChange: onChange,
    onRunQuery: onRunQuery,
    aggregators: ['avg'],
    fillPolicies: ['none'],
    tsdbVersion: tsdbVersion,
  };

  Object.assign(props, propOverrides);

  return render(<DownSample {...props} />);
};
describe('DownSample', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render downsample section', () => {
    setup(tsdbVersions[0].value);
    expect(screen.getByTestId(testIds.section)).toBeInTheDocument();
  });

  describe('downsample interval', () => {
    it('should call runQuery on blur', () => {
      setup(tsdbVersions[0].value);
      fireEvent.click(screen.getByTestId('downsample-interval'));
      fireEvent.blur(screen.getByTestId('downsample-interval'));
      expect(onRunQuery).toHaveBeenCalled();
    });
  });

  describe('aggregator select', () => {
    it('should contain an aggregator', () => {
      setup(tsdbVersions[0].value);
      expect(screen.getByText('avg')).toBeInTheDocument();
    });
  });

  describe('fillpolicies select', () => {
    it('should contain an fillpolicy for versions >= 2.2', () => {
      setup(tsdbVersions[1].value);
      expect(screen.getByText('none')).toBeInTheDocument();
    });

    it('does not display fill policy for version >= 2', () => {
      setup(tsdbVersions[0].value);
      expect(screen.queryByText('none')).toBeNull();
    });
  });
});

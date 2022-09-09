import { render, screen } from '@testing-library/react';
import React from 'react';

import { OpenTsdbQuery } from '../types';

import { DownSample, DownSampleProps, testIds } from './DownSample';

const setup = (tsdbVersion: Number, propOverrides?: Object) => {
  const onRunQuery = jest.fn();
  const onChange = jest.fn();
  const query: OpenTsdbQuery = { metric: '', refId: 'A' };
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
  it('should render downsample section', () => {
    setup(1);
    expect(screen.getByTestId(testIds.section)).toBeInTheDocument();
  });

  // describe('downsample interval', () => {
  //   it('should call onChange on blur', () => {

  //   });
  // });

  // describe('aggregator select', () => {
  //   it('should contain an aggregator', () => {

  //   });
  // });

  // describe('fillpolicies select', () => {
  //   it('should contain an fillpolicy', () => {

  //   });

  //   it('displays fill policy for version >= 2', () => {

  //   });
  // });
});

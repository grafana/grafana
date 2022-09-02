import { render, screen } from '@testing-library/react';
import React from 'react';

import { OpenTsdbQuery } from '../types';

import { MetricSection, MetricSectionProps, testIds } from './MetricSection';

const setup = (propOverrides?: Object) => {
  const onRunQuery = jest.fn();
  const onChange = jest.fn();
  const suggestMetrics = jest.fn();
  const query: OpenTsdbQuery = { metric: '', refId: 'A' };
  const props: MetricSectionProps = {
    query,
    onChange: onChange,
    onRunQuery: onRunQuery,
    suggestMetrics: suggestMetrics,
    aggregators: ['avg'],
  };

  Object.assign(props, propOverrides);

  return render(<MetricSection {...props} />);
};
describe('MetricSection', () => {
  it('should render section', () => {
    setup();
    expect(screen.getByTestId(testIds.section)).toBeInTheDocument();
  });

  // describe('metric select', () => {
  //   it('calls suggestMetrics on click', () => {

  //   });
  // });

  // describe('aggregator select', () => {
  //   it('should contain an aggregator', () => {

  //   });
  // });

  // describe('alias input', () => {
  //   it('should call onChange on blur', () => {

  //   });
  // });
});

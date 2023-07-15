import { render, screen } from '@testing-library/react';
import React from 'react';

import { PrometheusDatasource } from '../datasource';
import { PromQuery } from '../types';

import { PromExploreExtraFieldProps, PromExploreExtraField, testIds } from './PromExploreExtraField';

const setup = (propOverrides?: PromExploreExtraFieldProps) => {
  const query = { exemplar: false } as PromQuery;
  const datasource = {} as PrometheusDatasource;
  const onChange = jest.fn();
  const onRunQuery = jest.fn();

  const props: PromExploreExtraFieldProps = {
    onChange,
    onRunQuery,
    query,
    datasource,
  };

  Object.assign(props, propOverrides);

  return render(<PromExploreExtraField {...props} />);
};

describe('PromExploreExtraField', () => {
  it('should render step field', () => {
    setup();
    expect(screen.getByTestId(testIds.stepField)).toBeInTheDocument();
  });

  it('should render query type field', () => {
    setup();
    expect(screen.getByTestId(testIds.queryTypeField)).toBeInTheDocument();
  });
});

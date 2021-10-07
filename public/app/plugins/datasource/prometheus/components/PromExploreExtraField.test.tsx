import React from 'react';
import { render, screen } from '@testing-library/react';
import { PromExploreExtraFieldProps, PromExploreExtraField } from './PromExploreExtraField';

const setup = (propOverrides?: PromExploreExtraFieldProps) => {
  const query = { exemplar: false };
  const datasource = {};
  const onChange = jest.fn();
  const onRunQuery = jest.fn();

  const props: any = {
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
    expect(screen.getByTestId('stepField')).toBeInTheDocument();
  });

  it('should render query type field', () => {
    setup();
    expect(screen.getByTestId('queryTypeField')).toBeInTheDocument();
  });
});

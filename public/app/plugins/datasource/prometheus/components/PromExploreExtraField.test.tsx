import React from 'react';
import { render, screen } from '@testing-library/react';
import { PromExploreExtraFieldProps, PromExploreExtraField } from './PromExploreExtraField';
import { Observable } from 'rxjs';

const setup = (propOverrides?: PromExploreExtraFieldProps) => {
  const queryType = 'range';
  const stepValue = '1';
  const query = { exemplar: false };
  const datasource = { exemplarErrors: new Observable() };
  const onStepChange = jest.fn();
  const onQueryTypeChange = jest.fn();
  const onKeyDownFunc = jest.fn();

  const props: any = {
    queryType,
    stepValue,
    query,
    onStepChange,
    onQueryTypeChange,
    onKeyDownFunc,
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

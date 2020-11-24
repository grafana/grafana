import React from 'react';
import { render, screen } from '@testing-library/react';
import { LokiExploreExtraFieldProps, LokiExploreExtraField } from './LokiExploreExtraField';

const setup = (propOverrides?: LokiExploreExtraFieldProps) => {
  const queryType = 'range';
  const lineLimitValue = '1';
  const onLineLimitChange = jest.fn();
  const onQueryTypeChange = jest.fn();
  const onKeyDownFunc = jest.fn();

  const props: any = {
    queryType,
    lineLimitValue,
    onLineLimitChange,
    onQueryTypeChange,
    onKeyDownFunc,
  };

  Object.assign(props, propOverrides);

  return render(<LokiExploreExtraField {...props} />);
};

describe('LokiExploreExtraField', () => {
  it('should render step field', () => {
    setup();
    expect(screen.getByTestId('lineLimitField')).toBeInTheDocument();
  });

  it('should render query type field', () => {
    setup();
    expect(screen.getByTestId('queryTypeField')).toBeInTheDocument();
  });
});

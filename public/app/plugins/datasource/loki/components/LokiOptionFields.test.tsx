import { render, screen } from '@testing-library/react';
import React from 'react';

import { LokiOptionFieldsProps, LokiOptionFields } from './LokiOptionFields';

const setup = () => {
  const lineLimitValue = '1';
  const resolution = 1;
  const query = { refId: '1', expr: 'query' };
  const onChange = jest.fn();
  const onRunQuery = jest.fn();

  const props: LokiOptionFieldsProps = {
    lineLimitValue,
    resolution,
    query,
    onChange,
    onRunQuery,
  };

  return render(<LokiOptionFields {...props} />);
};

describe('LokiOptionFields', () => {
  it('should render step field', () => {
    setup();
    expect(screen.getByTestId('lineLimitField')).toBeInTheDocument();
  });

  it('should render query type field', () => {
    setup();
    expect(screen.getByTestId('queryTypeField')).toBeInTheDocument();
  });
});

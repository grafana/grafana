import { render, screen } from '@testing-library/react';

import { LokiOptionFieldsProps, LokiOptionFields, preprocessMaxLines } from './LokiOptionFields';

const setup = () => {
  const lineLimitValue = '1';
  const query = { refId: '1', expr: 'query' };
  const onChange = jest.fn();
  const onRunQuery = jest.fn();

  const props: LokiOptionFieldsProps = {
    lineLimitValue,
    query,
    onChange,
    onRunQuery,
  };

  return props;
};

describe('Line Limit Field', () => {
  it('should render a line limit field', () => {
    const props = setup();
    render(<LokiOptionFields {...props} />);
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('should have a default value of 1', () => {
    const props = setup();
    render(<LokiOptionFields {...props} />);
    expect(screen.getByRole('spinbutton')).toHaveValue(1);
  });

  it('displays the expected line limit value', () => {
    const props = setup();
    render(<LokiOptionFields {...props} lineLimitValue="123" />);
    expect(screen.getByRole('spinbutton')).toHaveValue(123);
  });
});

describe('preprocessMaxLines', () => {
  test.each([
    { inputValue: '', expected: undefined },
    { inputValue: 'abc', expected: undefined },
    { inputValue: '-1', expected: undefined },
    { inputValue: '1', expected: 1 },
    { inputValue: '100', expected: 100 },
  ])('should return correct max lines value', ({ inputValue, expected }) => {
    expect(preprocessMaxLines(inputValue)).toBe(expected);
  });
});

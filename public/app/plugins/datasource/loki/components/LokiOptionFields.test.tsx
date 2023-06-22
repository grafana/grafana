import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

import { LokiOptionFieldsProps, LokiOptionFields, preprocessMaxLines } from './LokiOptionFields';

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

  return props;
};

describe('Query Type Field', () => {
  it('should render a query type field', () => {
    const props = setup();
    render(<LokiOptionFields {...props} />);
    expect(screen.getByTestId('queryTypeField')).toBeInTheDocument();
  });

  it('should have a default value of "Range"', () => {
    const props = setup();
    render(<LokiOptionFields {...props} />);
    expect(screen.getByLabelText('Range')).toBeChecked();
    expect(screen.getByLabelText('Instant')).not.toBeChecked();
  });

  it('should call onChange when value is changed', async () => {
    const props = setup();
    render(<LokiOptionFields {...props} />);
    fireEvent.click(screen.getByLabelText('Instant')); // (`userEvent.click()` triggers an error, so switching here to `fireEvent`.)
    await waitFor(() => expect(props.onChange).toHaveBeenCalledTimes(1));
  });

  it('renders as expected when the query type is instant', () => {
    const props = setup();
    render(<LokiOptionFields {...props} query={{ refId: '1', expr: 'query', instant: true }} />);
    expect(screen.getByLabelText('Instant')).toBeChecked();
    expect(screen.getByLabelText('Range')).not.toBeChecked();
  });
});

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

describe('Resolution Field', () => {
  it('should render the resolution field', () => {
    const props = setup();
    render(<LokiOptionFields {...props} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should have a default value of 1', async () => {
    const props = setup();
    render(<LokiOptionFields {...props} />);
    expect(await screen.findByText('1/1')).toBeInTheDocument();
  });

  it('displays the expected resolution value', async () => {
    const props = setup();
    render(<LokiOptionFields {...props} resolution={5} />);
    expect(await screen.findByText('1/5')).toBeInTheDocument();
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

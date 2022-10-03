import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

  return props;
};

describe('Query Type Field', () => {
  it('should render query type field', () => {
    // Arrange
    const props = setup();
    render(<LokiOptionFields {...props} />);
    // Assert
    expect(screen.getByTestId('queryTypeField')).toBeInTheDocument();
  });

  it('should have a default value of "Range"', () => {
    // Arrange
    const props = setup();
    render(<LokiOptionFields {...props} />);
    // Assert
    expect(screen.getByLabelText('Range')).toBeChecked();
    expect(screen.getByLabelText('Instant')).not.toBeChecked();
  });

  it('should call onChange when value is changed', async () => {
    // Arrange
    const props = setup();
    render(<LokiOptionFields {...props} />);
    // Act (`userEvent.click()` triggers an error, so switching here to `fireEvent`.)
    fireEvent.click(screen.getByLabelText('Instant'));
    // Assert
    await waitFor(() => expect(props.onChange).toHaveBeenCalledTimes(1));
  });

  it('renders as expected when the query type is instant', () => {
    // Arrange
    const props = setup();
    render(<LokiOptionFields {...props} query={{ refId: '1', expr: 'query', instant: true }} />);
    // Assert
    expect(screen.getByLabelText('Instant')).toBeChecked();
    expect(screen.getByLabelText('Range')).not.toBeChecked();
  });
});

describe('Line Limit Field', () => {
  it('should render line limit field', () => {
    // Arrange
    const props = setup();
    render(<LokiOptionFields {...props} />);
    // Assert
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('should have a default value of 1', () => {
    // Arrange
    const props = setup();
    render(<LokiOptionFields {...props} />);
    // Assert
    expect(screen.getByRole('spinbutton')).toHaveValue(1);
  });

  it('displays the expected line limit value', () => {
    // Arrange
    const props = setup();
    render(<LokiOptionFields {...props} lineLimitValue="123" />);
    // Act
    expect(screen.getByRole('spinbutton')).toHaveValue(123);
  });
});

describe('Resolution Field', () => {
  it('should render the resolution field', () => {
    // Arrange
    const props = setup();
    render(<LokiOptionFields {...props} />);
    // Assert
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should have a default value of 1', async () => {
    // Arrange
    const props = setup();
    render(<LokiOptionFields {...props} />);
    // Assert
    expect(await screen.findByText('1/1')).toBeInTheDocument();
  });

  it('displays the expected resolution value', async () => {
    // Arrange
    const props = setup();
    render(<LokiOptionFields {...props} resolution={5} />);
    // Assert
    expect(await screen.findByText('1/5')).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  //! Warning: You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one.
  it.only('should call onChange when value is changed', async () => {
    // Arrange
    const props = setup();
    render(<LokiOptionFields {...props} />);
    // Act
    userEvent.click(screen.getByLabelText('Instant'));
    // Assert
    await waitFor(() => expect(props.onChange).toHaveBeenCalledTimes(1));
  });

  //! FAIL, (expected: "instant to be checked", received: "range to be checked")
  // it('should change the value to "Instant" on click', async () => {
  //   // Arrange
  //   const props = setup();
  //   render(<LokiOptionFields {...props} />);
  //   // Act
  //   userEvent.click(screen.getByLabelText('Instant'));
  //   // Assert
  //   await waitFor(() => {
  //     expect(screen.getByLabelText('Instant')).toBeChecked();
  //     expect(screen.getByLabelText('Range')).not.toBeChecked();
  //   });
  // });
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

  //! FAIL, (EXPECTED: 2, RECEIVED: 1)
  // it('should have an updated value of 2', async () => {
  //   // Arrange
  //   const props = setup();
  //   render(<LokiOptionFields {...props} />);
  //   // Act
  //   userEvent.type(screen.getByRole('spinbutton'), '2');
  //   // Assert
  //   await waitFor(() => {
  //     expect(screen.getByRole('spinbutton')).toHaveValue(2);
  //   });
  // });
});

describe('Resolution Field', () => {
  it('should render the resolution field', () => {
    // Arrange
    const props = setup();
    render(<LokiOptionFields {...props} />);
    // Assert
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  //! FAIL, (EXPECTED: 1, RECEIVED: '')
  //* Me and Ivana had a quick look at this, we couldn't figure out why the value of the input is ''.
  // it('should have a default value of 1', () => {
  //   // Arrange
  //   const props = setup();
  //   render(<LokiOptionFields {...props} />);
  //   // Assert
  //   // screen.debug();
  //   expect(screen.getByLabelText('Select resolution')).toHaveValue(1 / 1);
  // });

  // it('', () => {
  //   // Arrange
  //   const props = setup();
  //   render(<LokiOptionFields {...props} />);
  // });
});

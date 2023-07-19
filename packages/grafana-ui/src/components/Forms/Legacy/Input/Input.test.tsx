import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { ValidationEvents } from '../../../../types';
import { EventsWithValidation } from '../../../../utils';

import { Input } from './Input';

const PLACEHOLDER_TEXT = 'Placeholder Text';
const TEST_ERROR_MESSAGE = 'Value must be empty or less than 3 chars';
const testBlurValidation: ValidationEvents = {
  [EventsWithValidation.onBlur]: [
    {
      rule: (value: string) => {
        return !value || value.length < 3;
      },
      errorMessage: TEST_ERROR_MESSAGE,
    },
  ],
};

describe('Input', () => {
  it('renders correctly', () => {
    expect(() => render(<Input />)).not.toThrow();
  });

  it('should validate with error onBlur', async () => {
    render(<Input validationEvents={testBlurValidation} placeholder={PLACEHOLDER_TEXT} />);
    const inputEl = screen.getByPlaceholderText(PLACEHOLDER_TEXT);
    await userEvent.type(inputEl, 'abcde');
    // blur the field
    await userEvent.click(document.body);
    await screen.findByText(TEST_ERROR_MESSAGE);
  });

  it('should validate without error onBlur', async () => {
    render(<Input validationEvents={testBlurValidation} placeholder={PLACEHOLDER_TEXT} />);
    const inputEl = screen.getByPlaceholderText(PLACEHOLDER_TEXT);
    await userEvent.type(inputEl, 'Hi');
    // blur the field
    await userEvent.click(document.body);
    const errorMessage = screen.queryByText(TEST_ERROR_MESSAGE);
    expect(errorMessage).not.toBeInTheDocument();
  });
});

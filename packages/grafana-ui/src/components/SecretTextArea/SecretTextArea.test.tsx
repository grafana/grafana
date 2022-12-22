import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { SecretTextArea, RESET_BUTTON_TEXT, CONFIGURED_TEXT } from './SecretTextArea';

const PLACEHOLDER_TEXT = 'Your secret...';

describe('<SecretTextArea />', () => {
  it('should render an input if the secret is not configured', () => {
    render(
      <SecretTextArea isConfigured={false} onChange={() => {}} onReset={() => {}} placeholder={PLACEHOLDER_TEXT} />
    );

    const input = screen.getByPlaceholderText(PLACEHOLDER_TEXT);

    // Should show an enabled input
    expect(input).toBeInTheDocument();
    expect(input).not.toBeDisabled();

    // Should not show a "Reset" button
    expect(screen.queryByRole('button', { name: RESET_BUTTON_TEXT })).not.toBeInTheDocument();
  });

  it('should render a disabled textarea with a reset button if the secret is already configured', () => {
    render(
      <SecretTextArea isConfigured={true} onChange={() => {}} onReset={() => {}} placeholder={PLACEHOLDER_TEXT} />
    );

    const textArea = screen.getByPlaceholderText(PLACEHOLDER_TEXT);

    // Should show a disabled input
    expect(textArea).toBeInTheDocument();
    expect(textArea).toBeDisabled();
    expect(textArea).toHaveValue(CONFIGURED_TEXT);

    // Should show a reset button
    expect(screen.queryByRole('button', { name: RESET_BUTTON_TEXT })).toBeInTheDocument();
  });

  it('should be possible to reset a configured secret', async () => {
    const onReset = jest.fn();

    render(<SecretTextArea isConfigured={true} onChange={() => {}} onReset={onReset} placeholder={PLACEHOLDER_TEXT} />);

    // Should show a reset button and a disabled input
    expect(screen.queryByPlaceholderText(PLACEHOLDER_TEXT)).toBeDisabled();
    expect(screen.queryByRole('button', { name: RESET_BUTTON_TEXT })).toBeInTheDocument();

    // Click on "Reset"
    await userEvent.click(screen.getByRole('button', { name: RESET_BUTTON_TEXT }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('should be possible to change the value of the secret', async () => {
    const onChange = jest.fn();

    render(
      <SecretTextArea isConfigured={false} onChange={onChange} onReset={() => {}} placeholder={PLACEHOLDER_TEXT} />
    );

    const textArea = screen.getByPlaceholderText(PLACEHOLDER_TEXT);

    expect(textArea).toHaveValue('');

    await userEvent.type(textArea, 'Foo');

    expect(onChange).toHaveBeenCalled();
    expect(textArea).toHaveValue('Foo');
  });
});

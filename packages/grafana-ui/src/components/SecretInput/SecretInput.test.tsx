import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SecretInput, RESET_BUTTON_TEXT, CONFIGURED_TEXT } from './SecretInput';

const PLACEHOLDER_TEXT = 'Your secret...';

describe('<SecretInput />', () => {
  it('should render an input if the secret is not configured', () => {
    render(<SecretInput isConfigured={false} onChange={() => {}} onReset={() => {}} placeholder={PLACEHOLDER_TEXT} />);

    const input = screen.getByPlaceholderText(PLACEHOLDER_TEXT);

    // Should show an enabled input
    expect(input).toBeInTheDocument();
    expect(input).toBeEnabled();

    // Should not show a "Reset" button
    expect(screen.queryByRole('button', { name: RESET_BUTTON_TEXT })).not.toBeInTheDocument();
  });

  it('should render a disabled input with a reset button if the secret is already configured', () => {
    render(<SecretInput isConfigured={true} onChange={() => {}} onReset={() => {}} placeholder={PLACEHOLDER_TEXT} />);

    const input = screen.getByPlaceholderText(PLACEHOLDER_TEXT);

    // Should show a disabled input
    expect(input).toBeInTheDocument();
    expect(input).toBeDisabled();
    expect(input).toHaveValue(CONFIGURED_TEXT);

    // Should show a reset button
    expect(screen.getByRole('button', { name: RESET_BUTTON_TEXT })).toBeInTheDocument();
  });

  it('should be possible to reset a configured secret', async () => {
    const onReset = jest.fn();

    render(<SecretInput isConfigured={true} onChange={() => {}} onReset={onReset} placeholder={PLACEHOLDER_TEXT} />);

    // Should show a reset button and a disabled input
    expect(screen.queryByPlaceholderText(PLACEHOLDER_TEXT)).toBeDisabled();
    expect(screen.getByRole('button', { name: RESET_BUTTON_TEXT })).toBeInTheDocument();

    // Click on "Reset"
    await userEvent.click(screen.getByRole('button', { name: RESET_BUTTON_TEXT }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('should be possible to change the value of the secret', async () => {
    const onChange = jest.fn();

    render(<SecretInput isConfigured={false} onChange={onChange} onReset={() => {}} placeholder={PLACEHOLDER_TEXT} />);

    const input = screen.getByPlaceholderText(PLACEHOLDER_TEXT);

    expect(input).toHaveValue('');

    await userEvent.type(input, 'Foo');

    expect(onChange).toHaveBeenCalled();
    expect(input).toHaveValue('Foo');
  });

  it('should not render a visibility toggle by default', () => {
    render(<SecretInput isConfigured={false} onChange={() => {}} onReset={() => {}} placeholder={PLACEHOLDER_TEXT} />);

    expect(screen.getByPlaceholderText(PLACEHOLDER_TEXT)).toHaveAttribute('type', 'password');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('should toggle the visibility of the secret between password and text', async () => {
    render(
      <SecretInput
        revealable={true}
        isConfigured={false}
        onChange={() => {}}
        onReset={() => {}}
        placeholder={PLACEHOLDER_TEXT}
      />
    );

    const input = screen.getByPlaceholderText(PLACEHOLDER_TEXT);

    // The secret should be masked by default
    expect(input).toHaveAttribute('type', 'password');

    const toggle = screen.getByRole('switch');
    expect(toggle).not.toBeChecked();

    // Reveal the secret
    await userEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(toggle).toBeChecked();

    // Hide the secret again
    await userEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'password');
    expect(toggle).not.toBeChecked();
  });

  it('should show the loading spinner instead of the visibility toggle while loading', () => {
    render(
      <SecretInput
        revealable={true}
        loading={true}
        isConfigured={false}
        onChange={() => {}}
        onReset={() => {}}
        placeholder={PLACEHOLDER_TEXT}
      />
    );

    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('should not render a visibility toggle when the secret is configured', () => {
    render(
      <SecretInput
        revealable={true}
        isConfigured={true}
        onChange={() => {}}
        onReset={() => {}}
        placeholder={PLACEHOLDER_TEXT}
      />
    );

    expect(screen.getByPlaceholderText(PLACEHOLDER_TEXT)).toBeDisabled();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('should allow pasting a value after the secret is revealed', async () => {
    const onChange = jest.fn();

    render(
      <SecretInput
        revealable={true}
        isConfigured={false}
        onChange={onChange}
        onReset={() => {}}
        placeholder={PLACEHOLDER_TEXT}
      />
    );

    const input = screen.getByPlaceholderText(PLACEHOLDER_TEXT);

    // Reveal the secret so it becomes a real text input
    await userEvent.click(screen.getByRole('switch'));
    expect(input).toHaveAttribute('type', 'text');

    // Paste a value into the revealed field
    input.focus();
    await userEvent.paste('pasted-secret');

    expect(onChange).toHaveBeenCalled();
    expect(input).toHaveValue('pasted-secret');
  });
});

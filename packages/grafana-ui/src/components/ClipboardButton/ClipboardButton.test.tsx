import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ClipboardButton } from './ClipboardButton';

const setup = (jsx: JSX.Element) => {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
};

describe('ClipboardButton', () => {
  const originalWindow = { ...window };

  beforeAll(() => {
    Object.assign(window, {
      isSecureContext: true,
    });
  });

  afterAll(() => {
    Object.assign(window, originalWindow);
  });

  it('should copy text to clipboard when clicked', async () => {
    const textToCopy = 'Copy me!';
    const onClipboardCopy = jest.fn();

    const { user } = setup(
      <ClipboardButton getText={() => textToCopy} onClipboardCopy={onClipboardCopy}>
        Copy
      </ClipboardButton>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    const clipboardText = await navigator.clipboard.readText();

    expect(clipboardText).toBe(textToCopy);
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    expect(onClipboardCopy).toHaveBeenCalledWith(textToCopy);
  });
});

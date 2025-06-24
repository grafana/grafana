import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ClipboardButton } from './ClipboardButton';

const setup = (jsx: JSX.Element) => {
  return {
    user: userEvent.setup({
      // Ensure that user events correctly advance timers:
      // https://github.com/testing-library/react-testing-library/issues/1197
      advanceTimers: jest.advanceTimersByTime,
    }),
    ...render(jsx),
  };
};

describe('ClipboardButton', () => {
  const originalWindow = { ...window };

  beforeAll(() => {
    jest.useFakeTimers();
    Object.assign(window, {
      isSecureContext: true,
    });
  });

  afterAll(() => {
    Object.assign(window, originalWindow);
    jest.useRealTimers();
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
    expect(await screen.findByText('Copied')).toBeInTheDocument();

    act(() => {
      jest.runAllTimers();
    });

    expect(screen.queryByText('Copied')).not.toBeInTheDocument();

    const clipboardText = await navigator.clipboard.readText();

    expect(clipboardText).toBe(textToCopy);
    expect(onClipboardCopy).toHaveBeenCalledWith(textToCopy);
  });
});

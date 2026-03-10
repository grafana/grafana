import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';

import { ClipboardButton } from './ClipboardButton';

const setup = (jsx: JSX.Element) => {
  return {
    user: userEvent.setup({
      // Ensure that user events correctly advance timers:
      // https://github.com/testing-library/react-testing-library/issues/1197
      advanceTimers: vi.advanceTimersByTime,
    }),
    ...render(jsx),
  };
};

describe('ClipboardButton', () => {
  const originalIsSecureContext = window.isSecureContext;

  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(window, 'isSecureContext', { value: true, writable: true });
  });

  afterAll(() => {
    Object.defineProperty(window, 'isSecureContext', { value: originalIsSecureContext, writable: true });
    vi.useRealTimers();
  });

  it('should copy text to clipboard when clicked', async () => {
    const textToCopy = 'Copy me!';
    const onClipboardCopy = vi.fn();

    const { user } = setup(
      <ClipboardButton getText={() => textToCopy} onClipboardCopy={onClipboardCopy}>
        Copy
      </ClipboardButton>
    );

    const button = screen.getByRole('button');
    await user.click(button);
    expect(await screen.findByText('Copied')).toBeInTheDocument();

    act(() => {
      vi.runAllTimers();
    });

    expect(screen.queryByText('Copied')).not.toBeInTheDocument();

    const clipboardText = await navigator.clipboard.readText();

    expect(clipboardText).toBe(textToCopy);
    expect(onClipboardCopy).toHaveBeenCalledWith(textToCopy);
  });
});

import { act, fireEvent, render, screen } from '@testing-library/react';

import { ClipboardButton } from './ClipboardButton';

Object.assign(window, {
  isSecureContext: true,
});

Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockReturnValueOnce(Promise.resolve()),
  },
});

describe('ClipboardButton', () => {
  it('should copy text to clipboard when clicked', async () => {
    const textToCopy = 'Copy me!';
    const onClipboardCopy = jest.fn();

    render(
      <ClipboardButton getText={() => textToCopy} onClipboardCopy={onClipboardCopy}>
        Copy
      </ClipboardButton>
    );

    await act(async () => {
      const button = screen.getByRole('button');
      await fireEvent.click(button);
    });

    expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith(textToCopy);
    expect(onClipboardCopy).toHaveBeenCalledWith(textToCopy);
  });
});

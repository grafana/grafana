import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ClipboardButton } from './ClipboardButton';

describe('ClipboardButton', () => {
  const originalWindow = { ...window };
  const originalNavigator = { ...navigator };

  beforeAll(() => {
    Object.assign(window, {
      isSecureContext: true,
    });

    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockReturnValueOnce(Promise.resolve()),
      },
    });
  });

  afterAll(() => {
    Object.assign(window, originalWindow);
    Object.assign(navigator, originalNavigator);
  });

  it('should copy text to clipboard when clicked', async () => {
    const textToCopy = 'Copy me!';
    const onClipboardCopy = jest.fn();

    render(
      <ClipboardButton getText={() => textToCopy} onClipboardCopy={onClipboardCopy}>
        Copy
      </ClipboardButton>
    );

    const button = screen.getByRole('button');
    await userEvent.click(button);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(textToCopy);
    expect(onClipboardCopy).toHaveBeenCalledWith(textToCopy);
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type LinkModel, textUtil } from '@grafana/data';
import { useAppNotification } from 'app/core/copy/appNotification';
import { copyStringToClipboard } from 'app/core/utils/explore';

import { ShareSpanButton } from './ShareSpanButton';

jest.mock('app/core/copy/appNotification', () => ({
  useAppNotification: jest.fn(() => ({
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  })),
}));

jest.mock('app/core/utils/explore', () => ({
  ...jest.requireActual('app/core/utils/explore'),
  copyStringToClipboard: jest.fn(),
}));

describe('ShareSpanButton', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('copies the span deep-link as an absolute URL', async () => {
    const notifyApp = { success: jest.fn(), warning: jest.fn(), error: jest.fn(), info: jest.fn() };
    jest.mocked(useAppNotification).mockReturnValue(notifyApp);

    render(
      <ShareSpanButton
        focusSpanLink={
          {
            href: '/explore?spanId=abc',
            title: 'Deep link to this span',
            origin: {},
          } as unknown as LinkModel
        }
      />
    );

    await userEvent.click(screen.getByTestId('share-span-button'));

    expect(copyStringToClipboard).toHaveBeenCalledWith('http://localhost/explore?spanId=abc');
    expect(notifyApp.success).toHaveBeenCalledWith('Link copied to clipboard');
  });

  it('copies the current page URL when sanitization blanks the span href', async () => {
    jest.spyOn(textUtil, 'sanitizeUrl').mockReturnValue('about:blank');
    const notifyApp = { success: jest.fn(), warning: jest.fn(), error: jest.fn(), info: jest.fn() };
    jest.mocked(useAppNotification).mockReturnValue(notifyApp);

    render(
      <ShareSpanButton
        focusSpanLink={
          {
            href: '/explore?spanId=abc',
            title: 'Deep link to this span',
            origin: {},
          } as unknown as LinkModel
        }
      />
    );

    await userEvent.click(screen.getByTestId('share-span-button'));

    expect(copyStringToClipboard).toHaveBeenCalledWith('http://localhost/');
  });
});

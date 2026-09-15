import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type LinkModel, textUtil } from '@grafana/data';

import { ShareSpanButton } from './ShareSpanButton';

describe('ShareSpanButton', () => {
  const originalIsSecureContext = window.isSecureContext;

  beforeEach(() => {
    Object.assign(window, { isSecureContext: true });
  });

  afterEach(() => {
    Object.assign(window, { isSecureContext: originalIsSecureContext });
    jest.restoreAllMocks();
  });

  it('copies the span deep-link as an absolute URL', async () => {
    const user = userEvent.setup();

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

    await user.click(screen.getByTestId('share-span-button'));

    expect(await navigator.clipboard.readText()).toBe('http://localhost/explore?spanId=abc');
  });

  it('copies the current page URL when sanitization blanks the span href', async () => {
    const user = userEvent.setup();
    jest.spyOn(textUtil, 'sanitizeUrl').mockReturnValue('about:blank');

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

    await user.click(screen.getByTestId('share-span-button'));

    expect(await navigator.clipboard.readText()).toBe('http://localhost/');
  });
});

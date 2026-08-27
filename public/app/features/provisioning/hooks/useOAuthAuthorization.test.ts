import { act, renderHook } from '@testing-library/react';

import { buildOAuthAuthorizeUrl, onOAuthAuthorizationComplete } from '../utils/connectionOAuth';

import { useOAuthAuthorization } from './useOAuthAuthorization';

jest.mock('../utils/connectionOAuth');

const authorizeUrl = 'https://gitlab.com/oauth/authorize?state=abc';

interface FakeTab {
  closed: boolean;
  close: jest.Mock;
  location: { href: string };
  opener: unknown;
}

function createFakeTab(): FakeTab {
  return { closed: false, close: jest.fn(), location: { href: '' }, opener: {} };
}

describe('useOAuthAuthorization', () => {
  let completionCallback: ((name: string, error?: string) => void) | undefined;
  const unsubscribe = jest.fn();
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    completionCallback = undefined;
    unsubscribe.mockClear();
    jest.mocked(buildOAuthAuthorizeUrl).mockReturnValue(authorizeUrl);
    jest.mocked(onOAuthAuthorizationComplete).mockImplementation((callback) => {
      completionCallback = callback;
      return unsubscribe;
    });
    openSpy = jest.spyOn(window, 'open');
  });

  afterEach(() => {
    jest.useRealTimers();
    openSpy.mockRestore();
  });

  function setup(tab: FakeTab | null = createFakeTab()) {
    // Window mock is intentionally partial; the hook only touches these fields.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    openSpy.mockReturnValue(tab as unknown as Window);
    const onComplete = jest.fn();
    const hook = renderHook(() => useOAuthAuthorization(onComplete));
    return { hook, onComplete, tab };
  }

  const authorizeParams = { type: 'gitlabOAuth' as const, clientID: 'client-1', name: 'conn-1' };

  it('navigates the tab to the authorize URL and enters the pending state', () => {
    const { hook, tab } = setup();

    act(() => {
      hook.result.current.openTab();
    });
    let returned: boolean | undefined;
    act(() => {
      returned = hook.result.current.authorize(authorizeParams);
    });

    expect(returned).toBe(true);
    expect(tab?.location.href).toBe(authorizeUrl);
    expect(tab?.opener).toBeNull();
    expect(hook.result.current.isPending).toBe(true);
  });

  it('completes when the callback reports the pending connection and ignores other names', () => {
    const { hook, onComplete } = setup();

    act(() => {
      hook.result.current.authorize(authorizeParams);
    });

    act(() => {
      completionCallback?.('other-conn');
    });
    expect(hook.result.current.isPending).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      completionCallback?.('conn-1', 'boom');
    });
    expect(hook.result.current.isPending).toBe(false);
    expect(onComplete).toHaveBeenCalledWith('conn-1', 'boom');
  });

  it('stays pending when the tab handle reports closed (COOP providers sever it)', () => {
    const { hook, onComplete, tab } = setup();

    act(() => {
      hook.result.current.authorize(authorizeParams);
    });

    tab!.closed = true;
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(hook.result.current.isPending).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('still delivers a completion after the tab handle reports closed', () => {
    const { hook, onComplete, tab } = setup();

    act(() => {
      hook.result.current.authorize(authorizeParams);
    });

    tab!.closed = true;
    act(() => {
      completionCallback?.('conn-1');
    });

    expect(onComplete).toHaveBeenCalledWith('conn-1', undefined);
    expect(hook.result.current.isPending).toBe(false);
  });

  it('cancel ends the pending state', () => {
    const { hook } = setup();

    act(() => {
      hook.result.current.authorize(authorizeParams);
    });
    act(() => {
      hook.result.current.cancel();
    });

    expect(hook.result.current.isPending).toBe(false);
  });

  it('stays pending while the tab remains open, with no blanket timeout', () => {
    const { hook } = setup();

    act(() => {
      hook.result.current.authorize(authorizeParams);
    });
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(hook.result.current.isPending).toBe(true);
  });

  it('returns false and stays idle when the browser blocks the tab', () => {
    const { hook } = setup(null);

    let returned: boolean | undefined;
    act(() => {
      returned = hook.result.current.authorize(authorizeParams);
    });

    expect(returned).toBe(false);
    expect(hook.result.current.isPending).toBe(false);
  });
});

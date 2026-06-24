import { browserSupportsWebAuthnAutofill, startAuthentication } from '@simplewebauthn/browser';
import { render, screen, waitFor } from '@testing-library/react';

import { getBackendSrv } from '@grafana/runtime';
import config from 'app/core/config';

import { PASSKEY_HINT_KEY, usePasskeyAutofill, usePasskeyButtonMode } from './passkeyLogin';

jest.mock('@simplewebauthn/browser', () => ({
  startAuthentication: jest.fn(),
  browserSupportsWebAuthnAutofill: jest.fn(),
}));

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    getBackendSrv: jest.fn(),
  };
});

const mockStartAuthentication = startAuthentication as jest.MockedFunction<typeof startAuthentication>;
const mockSupportsAutofill = browserSupportsWebAuthnAutofill as jest.MockedFunction<
  typeof browserSupportsWebAuthnAutofill
>;

const setLocation = (value: { assign: jest.Mock }) => {
  Object.defineProperty(window, 'location', { value, writable: true });
};

// usePasskeyButtonMode reads isUserVerifyingPlatformAuthenticatorAvailable off the PublicKeyCredential
// static; this redefines it per scenario.
const setPlatformAuthenticatorAvailable = (available: boolean) => {
  Object.defineProperty(window, 'PublicKeyCredential', {
    value: Object.assign(function () {}, {
      isUserVerifyingPlatformAuthenticatorAvailable: jest.fn().mockResolvedValue(available),
    }),
    configurable: true,
  });
};

const beginResponse = {
  sessionID: 'sess-1',
  options: { challenge: 'aGVsbG8', rpId: 'localhost', timeout: 60000, userVerification: 'required' },
};

const finishResponse = { message: 'ok', redirectUrl: '/d/home' };

const makeBackendSrv = () => {
  const post = jest.fn((url: string) => {
    if (url.endsWith('/login/begin')) {
      return Promise.resolve(beginResponse);
    }
    if (url.endsWith('/login/finish')) {
      return Promise.resolve(finishResponse);
    }
    return Promise.reject(new Error(`unexpected url ${url}`));
  });
  (getBackendSrv as jest.Mock).mockReturnValue({ post });
  return post;
};

// Harness mounts the hook the same way the login page does, so the test exercises the real effect.
function Harness() {
  usePasskeyAutofill();
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  config.passkey = { enabled: true };
  // Default: no autofill and a usable platform authenticator, so usePasskeyButtonMode resolves to a
  // visible state. Individual tests override these to exercise other branches.
  mockSupportsAutofill.mockResolvedValue(false);
  setPlatformAuthenticatorAvailable(true);
  setLocation({ assign: jest.fn() });
});

afterEach(() => {
  delete config.passkey;
  config.disableLoginForm = false;
});

describe('usePasskeyAutofill', () => {
  it('runs a conditional ceremony and signs the user in when autofill is supported', async () => {
    const post = makeBackendSrv();
    mockSupportsAutofill.mockResolvedValue(true);
    const assertion = { id: 'cred-1', response: {} };
    mockStartAuthentication.mockResolvedValueOnce(assertion as never);

    render(<Harness />);

    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith('/d/home'));
    // The conditional path must be used (useBrowserAutofill: true), not a modal ceremony.
    expect(mockStartAuthentication).toHaveBeenCalledWith({
      optionsJSON: beginResponse.options,
      useBrowserAutofill: true,
    });
    expect(post).toHaveBeenCalledWith(
      '/api/auth/passkey/login/finish',
      { sessionID: 'sess-1', response: assertion },
      { showErrorAlert: false }
    );
  });

  it('does not start a ceremony when passkeys are disabled', () => {
    config.passkey = { enabled: false };
    mockSupportsAutofill.mockResolvedValue(true);

    render(<Harness />);

    expect(mockSupportsAutofill).not.toHaveBeenCalled();
    expect(mockStartAuthentication).not.toHaveBeenCalled();
  });

  it('does not start a ceremony in passwordless mode (no username field to attach to)', () => {
    config.disableLoginForm = true;
    mockSupportsAutofill.mockResolvedValue(true);

    render(<Harness />);

    expect(mockSupportsAutofill).not.toHaveBeenCalled();
    expect(mockStartAuthentication).not.toHaveBeenCalled();
  });

  it('does not start a ceremony when the browser lacks Conditional UI support', async () => {
    makeBackendSrv();
    mockSupportsAutofill.mockResolvedValue(false);

    render(<Harness />);

    await waitFor(() => expect(mockSupportsAutofill).toHaveBeenCalled());
    expect(mockStartAuthentication).not.toHaveBeenCalled();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('stays silent when the user selects no passkey (ceremony aborts)', async () => {
    makeBackendSrv();
    mockSupportsAutofill.mockResolvedValue(true);
    mockStartAuthentication.mockRejectedValueOnce(new DOMException('no credential', 'NotAllowedError'));

    render(<Harness />);

    await waitFor(() => expect(mockStartAuthentication).toHaveBeenCalled());
    expect(window.location.assign).not.toHaveBeenCalled();
  });
});

// Renders the resolved mode so a test can assert on it once the async capability checks settle.
function ModeHarness() {
  const mode = usePasskeyButtonMode();
  return <div data-testid="mode">{mode}</div>;
}

describe('usePasskeyButtonMode', () => {
  it('is hidden when passkeys are disabled', async () => {
    config.passkey = { enabled: false };

    render(<ModeHarness />);

    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('hidden'));
  });

  it('is hidden when the browser lacks PublicKeyCredential', async () => {
    // @ts-expect-error — deleting an intrinsic for the test environment.
    delete window.PublicKeyCredential;

    render(<ModeHarness />);

    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('hidden'));
  });

  it('is hidden when the browser supports autofill (Conditional UI covers it)', async () => {
    mockSupportsAutofill.mockResolvedValue(true);

    render(<ModeHarness />);

    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('hidden'));
  });

  it('stays visible in passwordless mode even when autofill is supported', async () => {
    // The login form (and the username field autofill attaches to) is hidden in passwordless mode, so
    // the explicit button must remain the entry point rather than hiding behind autofill.
    config.disableLoginForm = true;
    mockSupportsAutofill.mockResolvedValue(true);

    render(<ModeHarness />);

    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('secondary'));
  });

  it('is secondary even when the device has no platform authenticator (cross-device flow)', async () => {
    // No local authenticator (e.g. desktop Linux Firefox) must still offer the button — "Use a
    // passkey from another device" is exactly the flow for this case.
    setPlatformAuthenticatorAvailable(false);

    render(<ModeHarness />);

    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('secondary'));
  });

  it('is primary when a passkey has been used on this browser before', async () => {
    localStorage.setItem(PASSKEY_HINT_KEY, 'true');

    render(<ModeHarness />);

    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('primary'));
  });

  it('is secondary on a no-autofill browser with no prior passkey', async () => {
    render(<ModeHarness />);

    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('secondary'));
  });
});

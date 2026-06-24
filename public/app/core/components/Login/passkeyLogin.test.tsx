import { browserSupportsWebAuthnAutofill, startAuthentication } from '@simplewebauthn/browser';
import { render, waitFor } from '@testing-library/react';

import { getBackendSrv } from '@grafana/runtime';
import config from 'app/core/config';

import { usePasskeyAutofill } from './passkeyLogin';

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
  config.passkey = { enabled: true };
  Object.defineProperty(window, 'PublicKeyCredential', { value: function () {}, configurable: true });
  setLocation({ assign: jest.fn() });
});

afterEach(() => {
  delete config.passkey;
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

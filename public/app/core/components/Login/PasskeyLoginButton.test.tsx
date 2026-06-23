import { startAuthentication } from '@simplewebauthn/browser';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getBackendSrv } from '@grafana/runtime';
import config from 'app/core/config';

import { PasskeyLoginButton } from './PasskeyLoginButton';

jest.mock('@simplewebauthn/browser', () => ({
  startAuthentication: jest.fn(),
}));

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    getBackendSrv: jest.fn(),
  };
});

const mockStartAuthentication = startAuthentication as jest.MockedFunction<typeof startAuthentication>;

const setLocation = (value: { assign: jest.Mock }) => {
  Object.defineProperty(window, 'location', { value, writable: true });
};

const beginResponse = {
  sessionID: 'sess-1',
  options: { challenge: 'aGVsbG8', rpId: 'localhost', timeout: 60000, userVerification: 'required' },
};

const finishResponse = { message: 'ok', redirectUrl: '/d/home' };

const makeBackendSrv = (overrides: Partial<{ begin: unknown; finish: unknown }> = {}) => {
  const post = jest.fn((url: string) => {
    if (url.endsWith('/login/begin')) {
      return overrides.begin instanceof Error
        ? Promise.reject(overrides.begin)
        : Promise.resolve(overrides.begin ?? beginResponse);
    }
    if (url.endsWith('/login/finish')) {
      return overrides.finish instanceof Error
        ? Promise.reject(overrides.finish)
        : Promise.resolve(overrides.finish ?? finishResponse);
    }
    return Promise.reject(new Error(`unexpected url ${url}`));
  });
  (getBackendSrv as jest.Mock).mockReturnValue({ post });
  return post;
};

beforeEach(() => {
  jest.clearAllMocks();
  config.passkey = { enabled: true };
  // PublicKeyCredential is required for the capability check.
  Object.defineProperty(window, 'PublicKeyCredential', { value: function () {}, configurable: true });
  setLocation({ assign: jest.fn() });
});

afterEach(() => {
  delete config.passkey;
});

describe('PasskeyLoginButton', () => {
  it('renders nothing when the feature flag is disabled', () => {
    config.passkey = { enabled: false };
    const { container } = render(<PasskeyLoginButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the browser lacks PublicKeyCredential', () => {
    // @ts-expect-error — deleting an intrinsic for the test environment.
    delete window.PublicKeyCredential;
    const { container } = render(<PasskeyLoginButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('redirects on a successful login ceremony', async () => {
    const post = makeBackendSrv();
    const assertion = { id: 'cred-1', response: {} };
    mockStartAuthentication.mockResolvedValueOnce(assertion as never);

    render(<PasskeyLoginButton />);
    await userEvent.click(screen.getByTestId('passkey-login-button'));

    await waitFor(() => expect(window.location.assign).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith('/api/auth/passkey/login/begin', undefined, { showErrorAlert: false });
    expect(mockStartAuthentication).toHaveBeenCalledWith({ optionsJSON: beginResponse.options });
    expect(post).toHaveBeenCalledWith(
      '/api/auth/passkey/login/finish',
      { sessionID: 'sess-1', response: assertion },
      { showErrorAlert: false }
    );
    expect(window.location.assign).toHaveBeenCalledWith('/d/home');
  });

  it('re-enables silently when the user cancels the ceremony', async () => {
    makeBackendSrv();
    mockStartAuthentication.mockRejectedValueOnce(new DOMException('cancelled', 'NotAllowedError'));

    render(<PasskeyLoginButton />);
    const button = screen.getByTestId('passkey-login-button');
    await userEvent.click(button);

    await waitFor(() => expect(button).not.toBeDisabled());
    expect(screen.queryByTestId('passkey-login-error')).not.toBeInTheDocument();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('shows the credential-not-found message when the backend rejects', async () => {
    const err = Object.assign(new Error('not found'), {
      status: 404,
      data: { messageId: 'passkey.credential-not-found' },
      config: { url: '' },
    });
    makeBackendSrv({ finish: err });
    mockStartAuthentication.mockResolvedValueOnce({ id: 'cred-1', response: {} } as never);

    render(<PasskeyLoginButton />);
    await userEvent.click(screen.getByTestId('passkey-login-button'));

    expect(await screen.findByTestId('passkey-login-error')).toHaveTextContent(/no passkey was found/i);
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('shows the expired message on a 410 response', async () => {
    const err = Object.assign(new Error('gone'), {
      status: 410,
      data: { messageId: 'passkey.challenge-expired' },
      config: { url: '' },
    });
    makeBackendSrv({ finish: err });
    mockStartAuthentication.mockResolvedValueOnce({ id: 'cred-1', response: {} } as never);

    render(<PasskeyLoginButton />);
    await userEvent.click(screen.getByTestId('passkey-login-button'));

    expect(await screen.findByTestId('passkey-login-error')).toHaveTextContent(/took too long/i);
  });
});

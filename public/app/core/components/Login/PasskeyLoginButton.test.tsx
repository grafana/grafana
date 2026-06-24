import { startAuthentication } from '@simplewebauthn/browser';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getBackendSrv } from '@grafana/runtime';

import { PasskeyLoginButton } from './PasskeyLoginButton';
import { PASSKEY_HINT_KEY } from './passkeyLogin';

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
  localStorage.clear();
  setLocation({ assign: jest.fn() });
});

describe('PasskeyLoginButton', () => {
  it('renders nothing while capability detection is in progress', () => {
    const { container } = render(<PasskeyLoginButton mode="checking" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the mode is hidden', () => {
    const { container } = render(<PasskeyLoginButton mode="hidden" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the primary label in primary mode', () => {
    render(<PasskeyLoginButton mode="primary" />);
    expect(screen.getByTestId('passkey-login-button')).toHaveTextContent(/sign in with a passkey/i);
  });

  it('shows the "another device" label in secondary mode', () => {
    render(<PasskeyLoginButton mode="secondary" />);
    expect(screen.getByTestId('passkey-login-button')).toHaveTextContent(/use a passkey from another device/i);
  });

  it('redirects on a successful login ceremony and records the hint', async () => {
    const post = makeBackendSrv();
    const assertion = { id: 'cred-1', response: {} };
    mockStartAuthentication.mockResolvedValueOnce(assertion as never);

    render(<PasskeyLoginButton mode="secondary" />);
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
    expect(localStorage.getItem(PASSKEY_HINT_KEY)).toBe('true');
  });

  it('re-enables silently when the user cancels the ceremony', async () => {
    makeBackendSrv();
    mockStartAuthentication.mockRejectedValueOnce(new DOMException('cancelled', 'NotAllowedError'));

    render(<PasskeyLoginButton mode="secondary" />);
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

    render(<PasskeyLoginButton mode="secondary" />);
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

    render(<PasskeyLoginButton mode="secondary" />);
    await userEvent.click(screen.getByTestId('passkey-login-button'));

    expect(await screen.findByTestId('passkey-login-error')).toHaveTextContent(/took too long/i);
  });
});

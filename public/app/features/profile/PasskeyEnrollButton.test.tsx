import { startRegistration } from '@simplewebauthn/browser';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getBackendSrv } from '@grafana/runtime';
import { PASSKEY_HINT_KEY } from 'app/core/components/Login/passkeyLogin';

import { PasskeyEnrollButton } from './PasskeyEnrollButton';

jest.mock('@simplewebauthn/browser', () => ({
  startRegistration: jest.fn(),
}));

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    getBackendSrv: jest.fn(),
  };
});

const mockStartRegistration = startRegistration as jest.MockedFunction<typeof startRegistration>;

const beginResponse = {
  sessionID: 'sess-1',
  options: { rp: { id: 'localhost', name: 'Grafana' }, user: {}, challenge: 'aGVsbG8' },
};

const installBackendSrv = (overrides: { begin?: unknown; finish?: unknown } = {}) => {
  const post = jest.fn((url: string) => {
    if (url.endsWith('/register/begin')) {
      return overrides.begin instanceof Error
        ? Promise.reject(overrides.begin)
        : Promise.resolve(overrides.begin ?? beginResponse);
    }
    if (url.endsWith('/register/finish')) {
      return overrides.finish instanceof Error
        ? Promise.reject(overrides.finish)
        : Promise.resolve(overrides.finish ?? { ok: true });
    }
    return Promise.reject(new Error(`unexpected url ${url}`));
  });
  (getBackendSrv as jest.Mock).mockReturnValue({ post });
  return post;
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe('PasskeyEnrollButton', () => {
  it('opens a modal with a default name when clicked', async () => {
    installBackendSrv();
    render(<PasskeyEnrollButton onEnrolled={jest.fn()} />);

    await userEvent.click(screen.getByTestId('passkey-enroll-button'));

    const input = await screen.findByLabelText('Passkey name');
    expect((input as HTMLInputElement).value).toMatch(/^Passkey \(/);
  });

  it('runs the registration ceremony and fires onEnrolled on success', async () => {
    const post = installBackendSrv();
    const credential = { id: 'cred-1', rawId: 'cred-1', response: {} };
    mockStartRegistration.mockResolvedValueOnce(credential as never);
    const onEnrolled = jest.fn();

    render(<PasskeyEnrollButton onEnrolled={onEnrolled} />);
    await userEvent.click(screen.getByTestId('passkey-enroll-button'));

    const input = await screen.findByLabelText('Passkey name');
    await userEvent.clear(input);
    await userEvent.type(input, 'Work laptop');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(onEnrolled).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith(
      '/api/user/passkey/register/begin',
      { name: 'Work laptop' },
      { showErrorAlert: false }
    );
    expect(mockStartRegistration).toHaveBeenCalledWith({ optionsJSON: beginResponse.options });
    expect(post).toHaveBeenCalledWith(
      '/api/user/passkey/register/finish',
      { sessionID: 'sess-1', name: 'Work laptop', response: credential },
      { showErrorAlert: false }
    );
    // Enrolling records the per-browser hint so the next login shows the primary passkey label.
    expect(localStorage.getItem(PASSKEY_HINT_KEY)).toBe('true');
  });

  it('keeps the modal open and stays silent when the user cancels the OS prompt', async () => {
    installBackendSrv();
    mockStartRegistration.mockRejectedValueOnce(new DOMException('cancelled', 'NotAllowedError'));
    const onEnrolled = jest.fn();

    render(<PasskeyEnrollButton onEnrolled={onEnrolled} />);
    await userEvent.click(screen.getByTestId('passkey-enroll-button'));
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(mockStartRegistration).toHaveBeenCalled());
    expect(onEnrolled).not.toHaveBeenCalled();
    expect(screen.queryByText(/could not register passkey/i)).not.toBeInTheDocument();
    // Modal still open — name input is still present.
    expect(screen.getByLabelText('Passkey name')).toBeInTheDocument();
    // A cancelled enrolment must not write the hint.
    expect(localStorage.getItem(PASSKEY_HINT_KEY)).toBeNull();
  });

  it('blocks submission with a field-level error when the user hits Enter on an empty name', async () => {
    const post = installBackendSrv();

    render(<PasskeyEnrollButton onEnrolled={jest.fn()} />);
    await userEvent.click(screen.getByTestId('passkey-enroll-button'));

    const input = await screen.findByLabelText('Passkey name');
    await userEvent.clear(input);
    await userEvent.type(input, '{Enter}');

    expect(await screen.findByText(/please enter a name/i)).toBeInTheDocument();
    // The form-level alert with its title never appears for client-side validation.
    expect(screen.queryByText('Could not register passkey')).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('shows the duplicate message when the backend rejects an already-registered credential', async () => {
    const err = Object.assign(new Error('dup'), {
      status: 409,
      data: { messageId: 'passkey.credential-already-registered' },
      config: { url: '' },
    });
    installBackendSrv({ finish: err });
    mockStartRegistration.mockResolvedValueOnce({ id: 'cred-1', response: {} } as never);

    render(<PasskeyEnrollButton onEnrolled={jest.fn()} />);
    await userEvent.click(screen.getByTestId('passkey-enroll-button'));
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(await screen.findByText(/already registered/i)).toBeInTheDocument();
  });
});

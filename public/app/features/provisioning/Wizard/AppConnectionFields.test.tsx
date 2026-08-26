import { HttpResponse, http } from 'msw';
import { type PropsWithChildren } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';

import { setupProvisioningMswServer } from '../mocks/server';

import { AppConnectionFields } from './AppConnectionFields';
import { StepStatusProvider } from './StepStatusContext';
import { type WizardFormData } from './types';

setupProvisioningMswServer();

const mockSave = jest.fn();
const mockCancelAuthorization = jest.fn();
let mockIsAuthorizing = true;

jest.mock('../hooks/useSaveConnection', () => ({
  useSaveConnection: () => ({
    save: mockSave,
    request: { isLoading: false },
    submitError: undefined,
    setSubmitError: jest.fn(),
    isAuthorizing: mockIsAuthorizing,
    cancelAuthorization: mockCancelAuthorization,
  }),
}));

function Providers({ children }: PropsWithChildren) {
  const methods = useForm<WizardFormData>({ defaultValues: { githubAppMode: 'new' } });
  return (
    <StepStatusProvider>
      <FormProvider {...methods}>{children}</FormProvider>
    </StepStatusProvider>
  );
}

function setup() {
  return render(
    <Providers>
      <AppConnectionFields
        provider="github"
        kind="oauth"
        onGitHubAppSubmit={jest.fn()}
        onAuthorizingChange={jest.fn()}
      />
    </Providers>
  );
}

describe('AppConnectionFields', () => {
  beforeEach(() => {
    mockSave.mockClear();
    mockCancelAuthorization.mockClear();
    mockIsAuthorizing = true;
  });

  it('disables the create button and blocks re-submits while authorization is pending', async () => {
    const { user } = setup();

    expect(await screen.findByText(/Waiting for authorization in the other tab/i)).toBeInTheDocument();

    const button = screen.getByRole('button', { name: /Waiting for authorization/i });
    expect(button).toBeDisabled();

    // A second click here would drop the pending listener and restart authorization.
    await user.click(button);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('offers an enabled cancel action on the pending alert', async () => {
    const { user } = setup();

    const cancelButton = await screen.findByRole('button', { name: /Cancel authorization/i });
    expect(cancelButton).toBeEnabled();

    await user.click(cancelButton);
    expect(mockCancelAuthorization).toHaveBeenCalledTimes(1);
  });

  it('locks the mode radios while authorization is pending', async () => {
    setup();

    expect(await screen.findByText(/Waiting for authorization in the other tab/i)).toBeInTheDocument();

    // Switching modes would unmount the pending listener and orphan the created connection.
    expect(screen.getByRole('radio', { name: 'Choose an existing app' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Connect to a new app' })).toBeDisabled();
  });

  it('disables the existing-app option when no connections exist', async () => {
    mockIsAuthorizing = false;
    setup();

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Choose an existing app' })).toBeDisabled();
    });

    const newModeRadio = screen.getByRole('radio', { name: 'Connect to a new app' });
    expect(newModeRadio).toBeEnabled();
    expect(newModeRadio).toBeChecked();
    expect(screen.getByRole('button', { name: /Create and authorize/i })).toBeInTheDocument();
  });

  it('allows choosing an existing app when connections exist', async () => {
    mockIsAuthorizing = false;
    server.use(
      http.get(`${BASE}/connections`, () =>
        HttpResponse.json({
          items: [{ metadata: { name: 'conn-1' }, spec: { title: 'Existing', type: 'githubOAuth' } }],
        })
      )
    );
    const { user } = setup();

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Choose an existing app' })).toBeEnabled();
    });

    await user.click(screen.getByRole('radio', { name: 'Choose an existing app' }));
    expect(await screen.findByPlaceholderText('Select a connection')).toBeInTheDocument();
  });
});

import { type PropsWithChildren } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { setupProvisioningMswServer } from '../mocks/server';

import { AppConnectionFields } from './AppConnectionFields';
import { StepStatusProvider } from './StepStatusContext';
import { type WizardFormData } from './types';

setupProvisioningMswServer();

const mockSave = jest.fn();
const mockCancelAuthorization = jest.fn();

jest.mock('../hooks/useSaveConnection', () => ({
  useSaveConnection: () => ({
    save: mockSave,
    request: { isLoading: false },
    submitError: undefined,
    setSubmitError: jest.fn(),
    isAuthorizing: true,
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
      <AppConnectionFields provider="github" kind="oauth" onGitHubAppSubmit={jest.fn()} />
    </Providers>
  );
}

describe('AppConnectionFields', () => {
  beforeEach(() => {
    mockSave.mockClear();
    mockCancelAuthorization.mockClear();
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
});

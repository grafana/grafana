import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type UseFormRegister } from 'react-hook-form';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { checkPublicAccess } from '../GettingStarted/features';
import { type RepositoryFormData } from '../types';

import { WebhookSection } from './WebhookSection';

jest.mock('../GettingStarted/features', () => ({
  checkPublicAccess: jest.fn(),
}));

const mockCheckPublicAccess = checkPublicAccess as jest.MockedFunction<typeof checkPublicAccess>;

function setup(options: { isPublic?: boolean } = {}) {
  const { isPublic = true } = options;

  mockCheckPublicAccess.mockReturnValue(isPublic);

  const registerMock = jest.fn().mockReturnValue({});

  const renderResult = render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <WebhookSection register={registerMock as unknown as UseFormRegister<RepositoryFormData>} />
    </MemoryRouter>
  );

  return { renderResult, registerMock };
}

// The section is collapsed by default, so expand it to assert on its contents.
async function expandSection() {
  await userEvent.click(screen.getByText('Webhook'));
}

describe('WebhookSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the webhook URL field and registers webhook.baseUrl', async () => {
    const { registerMock } = setup({ isPublic: true });
    await expandSection();

    expect(screen.getByText('Webhook URL')).toBeInTheDocument();
    expect(registerMock).toHaveBeenCalledWith('webhook.baseUrl');
  });

  it('shows the learn more link on private instances', async () => {
    setup({ isPublic: false });
    await expandSection();

    expect(screen.getByRole('link', { name: 'Learn more' })).toBeInTheDocument();
  });

  it('hides the learn more link on public instances', async () => {
    setup({ isPublic: true });
    await expandSection();

    expect(screen.queryByRole('link', { name: 'Learn more' })).not.toBeInTheDocument();
  });
});

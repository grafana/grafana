import { render, screen } from '@testing-library/react';
import { UseFormRegister } from 'react-hook-form';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { checkImageRenderer, checkImageRenderingAllowed, checkPublicAccess } from '../GettingStarted/features';
import { RepositoryFormData } from '../types';

import { ConfigFormGithubCollapse } from './ConfigFormGithubCollapse';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetFrontendSettingsQuery: jest.fn(),
}));

jest.mock('../GettingStarted/features', () => ({
  checkImageRenderer: jest.fn(),
  checkPublicAccess: jest.fn(),
  checkImageRenderingAllowed: jest.fn(),
}));

const mockUseGetFrontendSettingsQuery = useGetFrontendSettingsQuery as jest.MockedFunction<
  typeof useGetFrontendSettingsQuery
>;
const mockCheckImageRenderer = checkImageRenderer as jest.MockedFunction<typeof checkImageRenderer>;
const mockCheckPublicAccess = checkPublicAccess as jest.MockedFunction<typeof checkPublicAccess>;
const mockCheckImageRenderingAllowed = checkImageRenderingAllowed as jest.MockedFunction<
  typeof checkImageRenderingAllowed
>;

type SetupOptions = {
  isPublic?: boolean;
  hasImageRenderer?: boolean;
  imageRenderingAllowed?: boolean;
  settingsData?: unknown;
};

function setup(options: SetupOptions = {}) {
  const { isPublic = true, hasImageRenderer = true, imageRenderingAllowed = true, settingsData } = options;

  const data = settingsData ?? { allowImageRendering: imageRenderingAllowed };

  mockCheckPublicAccess.mockReturnValue(isPublic);
  mockCheckImageRenderer.mockReturnValue(hasImageRenderer);
  mockCheckImageRenderingAllowed.mockReturnValue(imageRenderingAllowed);
  mockUseGetFrontendSettingsQuery.mockReturnValue({ data } as never);

  const registerMock = jest.fn().mockReturnValue({});

  const renderResult = render(
    <MemoryRouter>
      <ConfigFormGithubCollapse register={registerMock as unknown as UseFormRegister<RepositoryFormData>} />
    </MemoryRouter>
  );

  return { renderResult, registerMock };
}

describe('ConfigFormGithubCollapse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when image rendering is not allowed on a public instance', () => {
    const { renderResult } = setup({ imageRenderingAllowed: false, isPublic: true });

    expect(renderResult.container).toBeEmptyDOMElement();
    expect(screen.queryByText('GitHub features')).not.toBeInTheDocument();
  });

  it('renders preview checkbox when image rendering is allowed', () => {
    const { registerMock } = setup({ imageRenderingAllowed: true, isPublic: true, hasImageRenderer: true });

    expect(screen.getByText('GitHub features')).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox', {
      name: /Enable dashboard previews in pull requests/i,
    });
    expect(checkbox).toBeEnabled();
    expect(registerMock).toHaveBeenCalledWith('generateDashboardPreviews');
  });

  it('disables preview checkbox when image renderer is unavailable', () => {
    setup({ hasImageRenderer: false });

    const checkbox = screen.getByRole('checkbox', {
      name: /Enable dashboard previews in pull requests/i,
    });
    expect(checkbox).toBeDisabled();
  });

  it('disables preview checkbox and shows realtime feedback info on private instances', () => {
    setup({ isPublic: false, imageRenderingAllowed: true });

    const checkbox = screen.getByRole('checkbox', {
      name: /Enable dashboard previews in pull requests/i,
    });
    expect(checkbox).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Configure webhooks' })).toBeInTheDocument();
  });

  it('hides preview checkbox when image rendering is not allowed', () => {
    setup({ imageRenderingAllowed: false, isPublic: false });

    expect(
      screen.queryByRole('checkbox', {
        name: /Enable dashboard previews in pull requests/i,
      })
    ).not.toBeInTheDocument();
  });
});

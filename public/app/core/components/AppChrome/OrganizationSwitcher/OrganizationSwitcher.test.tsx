import { render, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { OrgRole } from '@grafana/data';
import { config } from '@grafana/runtime';
import { ContextSrv, setContextSrv } from 'app/core/services/context_srv';
import { getUserOrganizations, setUserOrganization } from 'app/features/org/state/actions';
import { type StoreState } from 'app/types/store';

import { OrganizationSwitcher } from './OrganizationSwitcher';

const mockDispatch = jest.fn();

jest.mock('app/features/org/state/actions', () => ({
  ...jest.requireActual('app/features/org/state/actions'),
  getUserOrganizations: jest.fn(),
  setUserOrganization: jest.fn((orgId: number) => ({ type: 'setUserOrganization', orgId })),
}));

jest.mock('app/types/store', () => ({
  ...jest.requireActual('app/types/store'),
  useDispatch: () => mockDispatch,
}));

const renderWithProvider = ({ initialState }: { initialState?: Partial<StoreState> }) => {
  render(
    <TestProvider storeState={initialState}>
      <OrganizationSwitcher />
    </TestProvider>
  );
};

describe('OrganisationSwitcher', () => {
  const originalLocation = window.location;
  let assignMock: jest.Mock;

  beforeEach(() => {
    mockDispatch.mockReset();
    jest.spyOn(window, 'matchMedia').mockImplementation(
      () =>
        ({
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          matches: true,
        }) as unknown as MediaQueryList
    );

    assignMock = jest.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, assign: assignMock },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('should only render if more than one organisations', () => {
    renderWithProvider({
      initialState: {
        organization: {
          organization: { name: 'test', id: 1 },
          userOrgs: [
            { orgId: 1, name: 'test', role: OrgRole.Admin },
            { orgId: 2, name: 'test2', role: OrgRole.Admin },
          ],
        },
      },
    });

    expect(screen.getByRole('combobox', { name: 'Change organization' })).toBeInTheDocument();
  });

  it('should not render if there is only one organisation', () => {
    renderWithProvider({
      initialState: {
        organization: {
          organization: { name: 'test', id: 1 },
          userOrgs: [{ orgId: 1, name: 'test', role: OrgRole.Admin }],
        },
      },
    });

    expect(screen.queryByRole('combobox', { name: 'Change organization' })).not.toBeInTheDocument();
  });

  it('should not render if there is no organisation available', () => {
    renderWithProvider({
      initialState: {
        organization: {
          organization: { name: 'test', id: 1 },
          userOrgs: [],
        },
      },
    });

    expect(screen.queryByRole('combobox', { name: 'Change organization' })).not.toBeInTheDocument();
  });

  it('should not render and not try to get user organizations if not signed in', () => {
    const contextSrv = new ContextSrv();
    contextSrv.user.isSignedIn = false;
    setContextSrv(contextSrv);

    renderWithProvider({
      initialState: {
        organization: {
          organization: { name: 'test', id: 1 },
          userOrgs: [],
        },
      },
    });

    expect(screen.queryByRole('combobox', { name: 'Change organization' })).not.toBeInTheDocument();
    expect(getUserOrganizations).not.toHaveBeenCalled();
  });

  it('dispatches setUserOrganization and navigates after the request resolves', async () => {
    mockDispatch.mockResolvedValueOnce(undefined);
    config.appSubUrl = '/grafana';

    renderWithProvider({
      initialState: {
        organization: {
          organization: { name: 'test', id: 1 },
          userOrgs: [
            { orgId: 1, name: 'test', role: OrgRole.Admin },
            { orgId: 2, name: 'test2', role: OrgRole.Admin },
          ],
        },
      },
    });

    await selectOptionInTest(screen.getByRole('combobox', { name: 'Change organization' }), 'test2');

    expect(setUserOrganization).toHaveBeenCalledWith(2);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'setUserOrganization', orgId: 2 });
    expect(assignMock).toHaveBeenCalledWith('/grafana/?orgId=2');
  });

  it('does not navigate when setUserOrganization rejects', async () => {
    mockDispatch.mockRejectedValueOnce(new Error('boom'));
    config.appSubUrl = '/grafana';

    renderWithProvider({
      initialState: {
        organization: {
          organization: { name: 'test', id: 1 },
          userOrgs: [
            { orgId: 1, name: 'test', role: OrgRole.Admin },
            { orgId: 2, name: 'test2', role: OrgRole.Admin },
          ],
        },
      },
    });

    await selectOptionInTest(screen.getByRole('combobox', { name: 'Change organization' }), 'test2');

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'setUserOrganization', orgId: 2 });
    expect(assignMock).not.toHaveBeenCalled();
  });
});

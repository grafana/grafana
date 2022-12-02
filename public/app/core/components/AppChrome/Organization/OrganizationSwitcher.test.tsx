import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { OrgRole } from '@grafana/data';
import { ContextSrv, setContextSrv } from 'app/core/services/context_srv';
import { getUserOrganizations } from 'app/features/org/state/actions';
import { configureStore } from 'app/store/configureStore';
import * as appTypes from 'app/types';

import { OrganizationSwitcher } from './OrganizationSwitcher';

jest.mock('app/features/org/state/actions', () => ({
  ...jest.requireActual('app/features/org/state/actions'),
  getUserOrganizations: jest.fn(),
  setUserOrganization: jest.fn(),
}));

jest.mock('app/types', () => ({
  ...jest.requireActual('app/types'),
  useDispatch: () => jest.fn(),
}));

const renderWithProvider = ({ initialState }: { initialState?: Partial<appTypes.StoreState> }) => {
  const store = configureStore(initialState);

  render(
    <Provider store={store}>
      <OrganizationSwitcher />
    </Provider>
  );
};

describe('OrganisationSwitcher', () => {
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

  it('should render a picker in mobile screen', () => {
    (window.matchMedia as jest.Mock).mockImplementation(() => ({
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      matches: () => true,
    }));
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

    expect(screen.getByRole('button', { name: /change organization/i })).toBeInTheDocument();
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
});

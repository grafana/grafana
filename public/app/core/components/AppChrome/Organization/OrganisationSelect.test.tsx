import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { OrgRole } from '@grafana/data';
import { configureStore } from 'app/store/configureStore';
import * as appTypes from 'app/types';

import { OrganisationSelect } from './OrganisationSelect';

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
      <OrganisationSelect />
    </Provider>
  );
};

describe('OrganisationSelect', () => {
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

    expect(screen.getByRole('combobox')).toBeInTheDocument();
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

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
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

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

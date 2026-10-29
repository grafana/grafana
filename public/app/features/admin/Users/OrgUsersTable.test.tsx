import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { type OrgUser } from 'app/types/user';

import { getMockUsers } from '../../users/mocks/userMocks';

import { OrgUsersTable, type Props } from './OrgUsersTable';

jest.mock('app/core/services/context_srv', () => ({
  ...jest.requireActual('app/core/services/context_srv'),
  contextSrv: {
    ...jest.requireActual('app/core/services/context_srv').contextSrv,
    hasPermission: () => true,
    hasPermissionInMetadata: () => true,
    licensedAccessControlEnabled: () => false,
  },
}));

const setup = (propOverrides?: object) => {
  const props: Props = {
    users: [] as OrgUser[],
    onRoleChange: jest.fn(),
    onRemoveUser: jest.fn(),
    changePage: jest.fn(),
    page: 0,
    totalPages: 1,
  };

  Object.assign(props, propOverrides);

  render(<OrgUsersTable {...props} />);
};

describe('Render', () => {
  it('should render component', async () => {
    expect(() => setup()).not.toThrow();
    expect(await screen.findByText('Login')).toBeInTheDocument();
  });

  it('should render users in table', async () => {
    const usersData = getMockUsers(5);
    setup({ users: usersData });

    await screen.findByText(usersData[0].name);

    usersData.forEach((user) => {
      expect(screen.getByText(user.name)).toBeInTheDocument();
    });
  });

  it('should render disabled flag when any of the Users are disabled', async () => {
    const usersData = getMockUsers(5);
    usersData[0].isDisabled = true;
    setup({ users: usersData });

    expect(await screen.findByText('Disabled')).toBeInTheDocument();
  });
  it('should render LDAP label', async () => {
    const usersData = getMockUsers(5);
    usersData[0].authLabels = ['LDAP'];
    setup({ users: usersData });
    expect(await screen.findByText(usersData[0].authLabels[0])).toBeInTheDocument();
  });
});

describe('Remove modal', () => {
  it('should render confirm check on delete', async () => {
    const usersData = getMockUsers(3);
    setup({ users: usersData });
    const user = userEvent.setup();

    await user.click((await screen.findAllByRole('button', { name: /delete/i }))[0]);

    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });
});

import { render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';

import { getMockInvitees } from '../users/mocks/userMocks';

import InviteesTable from './InviteesTable';

describe('InviteesTable', () => {
  const mockInvitees = getMockInvitees(5);
  const setup = () => {
    const store = configureStore();

    render(
      <Provider store={store}>
        <InviteesTable invitees={mockInvitees} />
      </Provider>
    );
  };

  it('should render without throwing', () => {
    expect(() => setup()).not.toThrow();
  });

  it('should render invitees username and email', () => {
    setup();

    expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();

    mockInvitees.forEach((mockInvitee) => {
      expect(screen.getByRole('cell', { name: mockInvitee.name })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: mockInvitee.email })).toBeInTheDocument();
    });
  });

  it('should render a `Copy invite` button for each row', () => {
    setup();

    const tableBody = screen.getByTestId('InviteesTable-body');
    const rows = within(tableBody).getAllByRole('row');
    expect(rows.length).toEqual(6);

    rows.forEach((row) => {
      expect(within(row).getByRole('button', { name: 'Copy Invite' })).toBeInTheDocument();
    });
  });

  it('should render a `Revoke invite` button for each row', () => {
    setup();

    const tableBody = screen.getByTestId('InviteesTable-body');
    const rows = within(tableBody).getAllByRole('row');
    expect(rows.length).toEqual(6);

    rows.forEach((row) => {
      expect(within(row).getByRole('button', { name: 'Revoke invite' })).toBeInTheDocument();
    });
  });
});

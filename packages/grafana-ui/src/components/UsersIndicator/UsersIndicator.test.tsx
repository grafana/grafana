import { render, screen } from '@testing-library/react';
import React from 'react';

import { UsersIndicator } from './UsersIndicator';

describe('UsersIndicator', () => {
  const users = [
    { user: { name: 'John Doe' }, lastActiveAt: '2022-04-19T10:30:00.000Z' },
    { user: { name: 'Jane Johnson' }, lastActiveAt: '2022-04-19T11:00:00.000Z' },
    { user: { name: 'Bob Doe' }, lastActiveAt: '2022-04-19T12:00:00.000Z' },
  ];

  it('renders the user icons correctly', () => {
    render(<UsersIndicator users={users.slice(0, 2)} limit={2} />);
    const johnUserIcon = screen.getByRole('button', { name: 'John Doe icon' });
    const janeUserIcon = screen.getByRole('button', { name: 'Jane Johnson icon' });
    expect(johnUserIcon).toBeInTheDocument();
    expect(janeUserIcon).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Extra users icon' })).not.toBeInTheDocument();
  });

  it('collapses the user icons when the limit is reached', () => {
    render(<UsersIndicator users={users} limit={2} />);
    const johnUserIcon = screen.getByRole('button', { name: 'John Doe icon' });
    const janeUserIcon = screen.getByRole('button', { name: 'Jane Johnson icon' });
    const moreUsersIcon = screen.getByRole('button', { name: 'Extra users icon' });
    expect(johnUserIcon).toBeInTheDocument();
    expect(janeUserIcon).toBeInTheDocument();
    expect(moreUsersIcon).toBeInTheDocument();
  });

  it("shows the '+' when there are too many users to display", () => {
    render(<UsersIndicator users={users} limit={1} />);
    const johnUserIcon = screen.getByRole('button', { name: 'John Doe icon' });
    const moreUsersIcon = screen.getByRole('button', { name: 'Extra users icon' });
    expect(moreUsersIcon).toHaveTextContent('+2');
    expect(johnUserIcon).toBeInTheDocument();
    expect(moreUsersIcon).toBeInTheDocument();
  });

  it('calls the onClick function when the user number indicator is clicked', () => {
    const handleClick = jest.fn();
    render(<UsersIndicator users={users} onClick={handleClick} limit={2} />);
    const moreUsersIcon = screen.getByRole('button', { name: 'Extra users icon' });
    expect(moreUsersIcon).toHaveTextContent('+1');
    moreUsersIcon.click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

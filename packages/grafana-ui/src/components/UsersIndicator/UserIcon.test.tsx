import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { UserIcon } from './UserIcon';

// setup userEvent
function setup(jsx: React.ReactElement) {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
}

const testUserView = {
  user: {
    name: 'John Smith',
    avatarUrl: 'https://example.com/avatar.png',
  },
  lastActiveAt: new Date().toISOString(),
};

describe('UserIcon', () => {
  it('renders user initials when no avatar URL is provided', () => {
    render(<UserIcon userView={{ ...testUserView, user: { name: 'John Smith' } }} />);
    expect(screen.getByLabelText('John Smith icon')).toHaveTextContent('JS');
  });

  it('renders avatar when URL is provided', () => {
    render(<UserIcon userView={testUserView} />);
    expect(screen.getByLabelText('John Smith avatar')).toHaveAttribute('src', 'https://example.com/avatar.png');
  });

  it('calls onClick handler when clicked', async () => {
    const handleClick = jest.fn();
    const { user } = setup(<UserIcon userView={testUserView} onClick={handleClick} />);
    await user.click(screen.getByLabelText('John Smith avatar'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows tooltip when showTooltip is true', async () => {
    const { user } = setup(<UserIcon userView={testUserView} />);
    //await userEvent.hover(screen.getByLabelText('John Smith avatar'));
    screen.getByLabelText('John Smith avatar').focus();
    await user.tab();
    //expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Active last 15m')).toBeInTheDocument();
  });

  it('does not show tooltip when showTooltip is false', () => {
    render(<UserIcon userView={testUserView} showTooltip={false} />);
    expect(screen.queryByText('John Smith')).not.toBeInTheDocument();
    expect(screen.queryByText('Active last 15m')).not.toBeInTheDocument();
  });
});

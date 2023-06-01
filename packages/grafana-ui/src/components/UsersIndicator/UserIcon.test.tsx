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
    expect(screen.getByAltText('John Smith avatar')).toHaveAttribute('src', 'https://example.com/avatar.png');
  });

  it('calls onClick handler when clicked', async () => {
    const handleClick = jest.fn();
    const { user } = setup(<UserIcon userView={testUserView} onClick={handleClick} />);
    await user.click(screen.getByLabelText('John Smith icon'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

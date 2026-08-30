import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

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

  it('renders a button when onClick handler is provided', () => {
    render(<UserIcon userView={testUserView} onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'John Smith icon' })).toBeInTheDocument();
  });

  it('does not render a button when onClick handler is not provided', () => {
    render(<UserIcon userView={testUserView} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a div with aria-label when onClick handler is not provided', () => {
    render(<UserIcon userView={testUserView} />);
    expect(screen.getByLabelText('John Smith icon')).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    render(
      <UserIcon userView={testUserView}>
        <span>Custom Content</span>
      </UserIcon>
    );
    expect(screen.getByText('Custom Content')).toBeInTheDocument();
  });

  it('renders tooltip if showTooltip is true', async () => {
    render(<UserIcon userView={testUserView} showTooltip={true} />);
    await userEvent.hover(screen.getByLabelText('John Smith icon'));
    expect(screen.getByTestId('user-icon-tooltip')).toBeInTheDocument();
  });

  it('does not render tooltip if showTooltip is false', () => {
    render(<UserIcon userView={testUserView} showTooltip={false} />);
    expect(screen.queryByTestId('user-icon-tooltip')).not.toBeInTheDocument();
  });

  it('renders tooltip if showTooltip is undefined', async () => {
    render(<UserIcon userView={testUserView} />);
    await userEvent.hover(screen.getByLabelText('John Smith icon'));
    expect(screen.getByTestId('user-icon-tooltip')).toBeInTheDocument();
  });
});

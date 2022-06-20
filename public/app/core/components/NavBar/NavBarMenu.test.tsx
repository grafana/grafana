import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { render } from 'test/redux-rtl';

import { NavModelItem } from '@grafana/data';

import { NavBarMenu } from './NavBarMenu';

// don't care about interaction tracking in our unit tests
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

describe('NavBarMenu', () => {
  const mockOnClose = jest.fn();
  const mockNavItems: NavModelItem[] = [];
  const mockSetMenuAnimationInProgress = jest.fn();

  beforeEach(() => {
    render(
      <NavBarMenu
        isOpen
        onClose={mockOnClose}
        navItems={mockNavItems}
        setMenuAnimationInProgress={mockSetMenuAnimationInProgress}
      />
    );
  });

  it('should render the component', () => {
    const sidemenu = screen.getByTestId('navbarmenu');
    expect(sidemenu).toBeInTheDocument();
  });

  it('has a close button', () => {
    const closeButton = screen.getAllByRole('button', { name: 'Close navigation menu' });
    // this is for mobile, will be hidden with display: none; on desktop
    expect(closeButton[0]).toBeInTheDocument();
    // this is for desktop, will be hidden with display: none; on mobile
    expect(closeButton[1]).toBeInTheDocument();
  });

  it('clicking the close button calls the onClose callback', async () => {
    const closeButton = screen.getAllByRole('button', { name: 'Close navigation menu' });
    expect(closeButton[0]).toBeInTheDocument();
    expect(closeButton[1]).toBeInTheDocument();
    await userEvent.click(closeButton[0]);
    expect(mockOnClose).toHaveBeenCalled();
    await userEvent.click(closeButton[1]);
    expect(mockOnClose).toHaveBeenCalled();
  });
});

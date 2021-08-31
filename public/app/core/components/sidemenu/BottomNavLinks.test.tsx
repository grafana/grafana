import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import appEvents from '../../app_events';
import { ShowModalReactEvent } from '../../../types/events';
import { HelpModal } from '../help/HelpModal';
import BottomNavLinks from './BottomNavLinks';

jest.mock('../../app_events', () => ({
  publish: jest.fn(),
}));

describe('BottomNavLinks', () => {
  const mockUser = {
    id: 1,
    isGrafanaAdmin: false,
    isSignedIn: false,
    orgCount: 2,
    orgRole: '',
    orgId: 1,
    login: 'hello',
    orgName: 'mockOrganization',
    timezone: 'UTC',
    helpFlags1: 1,
    lightTheme: false,
    hasEditPermissionInFolders: false,
  };

  it('renders the link text', () => {
    const mockLink = {
      text: 'Hello',
    };

    render(
      <BrowserRouter>
        <BottomNavLinks link={mockLink} user={mockUser} />
      </BrowserRouter>
    );
    const linkText = screen.getByText(mockLink.text);
    expect(linkText).toBeInTheDocument();
  });

  it('attaches the link url to the text if provided', () => {
    const mockLink = {
      text: 'Hello',
      url: '/route',
    };

    render(
      <BrowserRouter>
        <BottomNavLinks link={mockLink} user={mockUser} />
      </BrowserRouter>
    );
    const link = screen.getByRole('link', { name: mockLink.text });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', mockLink.url);
  });

  it('creates the correct children for the help link', () => {
    const mockLink = {
      id: 'help',
      text: 'Hello',
    };

    render(
      <BrowserRouter>
        <BottomNavLinks link={mockLink} user={mockUser} />
      </BrowserRouter>
    );
    const documentation = screen.getByRole('link', { name: 'Documentation' });
    const support = screen.getByRole('link', { name: 'Support' });
    const community = screen.getByRole('link', { name: 'Community' });
    const keyboardShortcuts = screen.getByText('Keyboard shortcuts');

    expect(documentation).toBeInTheDocument();
    expect(support).toBeInTheDocument();
    expect(community).toBeInTheDocument();
    expect(keyboardShortcuts).toBeInTheDocument();
  });

  it('clicking the keyboard shortcuts button shows the modal', () => {
    const mockLink = {
      id: 'help',
      text: 'Hello',
    };

    render(
      <BrowserRouter>
        <BottomNavLinks link={mockLink} user={mockUser} />
      </BrowserRouter>
    );
    const keyboardShortcuts = screen.getByText('Keyboard shortcuts');
    expect(keyboardShortcuts).toBeInTheDocument();
    userEvent.click(keyboardShortcuts);
    expect(appEvents.publish).toHaveBeenCalledWith(new ShowModalReactEvent({ component: HelpModal }));
  });

  it('shows the current organization and organization switcher if showOrgSwitcher is true', () => {
    const mockLink = {
      showOrgSwitcher: true,
      text: 'Hello',
    };

    render(
      <BrowserRouter>
        <BottomNavLinks link={mockLink} user={mockUser} />
      </BrowserRouter>
    );
    const currentOrg = screen.getByText(new RegExp(mockUser.orgName, 'i'));
    const orgSwitcher = screen.getByText('Switch organization');
    expect(currentOrg).toBeInTheDocument();
    expect(orgSwitcher).toBeInTheDocument();
  });
});

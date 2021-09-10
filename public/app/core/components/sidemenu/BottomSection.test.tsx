import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ShowModalReactEvent } from '../../../types/events';
import { HelpModal } from '../help/HelpModal';
import appEvents from '../../app_events';
import BottomSection from './BottomSection';

jest.mock('./utils', () => ({
  getForcedLoginUrl: () => '/mockForcedLoginUrl',
  isLinkActive: () => false,
  isSearchActive: () => false,
}));
jest.mock('../../app_events', () => ({
  publish: jest.fn(),
}));
jest.mock('../../config', () => ({
  bootData: {
    navTree: [
      {
        id: 'profile',
        hideFromMenu: true,
      },
      {
        id: 'help',
        hideFromMenu: true,
      },
      {
        hideFromMenu: false,
      },
      {
        hideFromMenu: true,
      },
    ],
  },
}));
jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    sidemenu: true,
    isSignedIn: true,
    isGrafanaAdmin: false,
    hasEditPermissionFolders: false,
    user: {
      orgCount: 5,
      orgName: 'Grafana',
    },
  },
}));

describe('BottomSection', () => {
  it('should render the correct children', () => {
    render(
      <BrowserRouter>
        <BottomSection />
      </BrowserRouter>
    );

    expect(screen.getByTestId('bottom-section-items').children.length).toBe(3);
  });

  it('creates the correct children for the help link', () => {
    render(
      <BrowserRouter>
        <div className="sidemenu-open--xs">
          <BottomSection />
        </div>
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
    render(
      <BrowserRouter>
        <BottomSection />
      </BrowserRouter>
    );

    const keyboardShortcuts = screen.getByText('Keyboard shortcuts');
    expect(keyboardShortcuts).toBeInTheDocument();

    userEvent.click(keyboardShortcuts);
    expect(appEvents.publish).toHaveBeenCalledWith(new ShowModalReactEvent({ component: HelpModal }));
  });

  it('shows the current organization and organization switcher if showOrgSwitcher is true', () => {
    render(
      <BrowserRouter>
        <BottomSection />
      </BrowserRouter>
    );

    const currentOrg = screen.getByText(new RegExp('Grafana', 'i'));
    const orgSwitcher = screen.getByText('Switch organization');
    expect(currentOrg).toBeInTheDocument();
    expect(orgSwitcher).toBeInTheDocument();
  });
});

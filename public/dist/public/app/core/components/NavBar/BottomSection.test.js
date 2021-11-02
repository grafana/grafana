import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ShowModalReactEvent } from '../../../types/events';
import { HelpModal } from '../help/HelpModal';
import appEvents from '../../app_events';
import BottomSection from './BottomSection';
jest.mock('./utils', function () { return ({
    getForcedLoginUrl: function () { return '/mockForcedLoginUrl'; },
    isLinkActive: function () { return false; },
    isSearchActive: function () { return false; },
}); });
jest.mock('../../app_events', function () { return ({
    publish: jest.fn(),
}); });
jest.mock('../../config', function () { return ({
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
}); });
jest.mock('app/core/services/context_srv', function () { return ({
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
}); });
describe('BottomSection', function () {
    it('should render the correct children', function () {
        render(React.createElement(BrowserRouter, null,
            React.createElement(BottomSection, null)));
        expect(screen.getByTestId('bottom-section-items').children.length).toBe(3);
    });
    it('creates the correct children for the help link', function () {
        render(React.createElement(BrowserRouter, null,
            React.createElement("div", { className: "sidemenu-open--xs" },
                React.createElement(BottomSection, null))));
        var documentation = screen.getByRole('link', { name: 'Documentation' });
        var support = screen.getByRole('link', { name: 'Support' });
        var community = screen.getByRole('link', { name: 'Community' });
        var keyboardShortcuts = screen.getByText('Keyboard shortcuts');
        expect(documentation).toBeInTheDocument();
        expect(support).toBeInTheDocument();
        expect(community).toBeInTheDocument();
        expect(keyboardShortcuts).toBeInTheDocument();
    });
    it('clicking the keyboard shortcuts button shows the modal', function () {
        render(React.createElement(BrowserRouter, null,
            React.createElement(BottomSection, null)));
        var keyboardShortcuts = screen.getByText('Keyboard shortcuts');
        expect(keyboardShortcuts).toBeInTheDocument();
        userEvent.click(keyboardShortcuts);
        expect(appEvents.publish).toHaveBeenCalledWith(new ShowModalReactEvent({ component: HelpModal }));
    });
    it('shows the current organization and organization switcher if showOrgSwitcher is true', function () {
        render(React.createElement(BrowserRouter, null,
            React.createElement(BottomSection, null)));
        var currentOrg = screen.getByText(new RegExp('Grafana', 'i'));
        var orgSwitcher = screen.getByText('Switch organization');
        expect(currentOrg).toBeInTheDocument();
        expect(orgSwitcher).toBeInTheDocument();
    });
});
//# sourceMappingURL=BottomSection.test.js.map
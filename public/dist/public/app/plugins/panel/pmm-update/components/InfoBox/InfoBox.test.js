import { render, screen } from '@testing-library/react';
import React from 'react';
import { InfoBox } from './InfoBox';
import { Messages } from './InfoBox.messages';
describe('InfoBox::', () => {
    it('should show that there are no updates by default', () => {
        render(React.createElement(InfoBox, null));
        expect(screen.getByText(Messages.noUpdates)).toBeInTheDocument();
        expect(screen.getByText(Messages.updatesNotice)).toBeInTheDocument();
    });
    it('should show a different message if upToDate is true', () => {
        render(React.createElement(InfoBox, { upToDate: true }));
        expect(screen.getByText(Messages.upToDate)).toBeInTheDocument();
    });
    it('should show an insufficient access message', () => {
        render(React.createElement(InfoBox, { hasNoAccess: true }));
        expect(screen.getByText(Messages.noAccess)).toBeInTheDocument();
    });
    it('should show updates disabled messages', () => {
        render(React.createElement(InfoBox, { updatesDisabled: true }));
        expect(screen.getByTestId('updates-disabled').textContent).toBe(`${Messages.updatesDisabled}${Messages.pmmSettings}`);
    });
    it('should show not online messages', () => {
        render(React.createElement(InfoBox, { isOnline: false }));
        expect(screen.getByText(Messages.notOnline)).toBeInTheDocument();
    });
});
//# sourceMappingURL=InfoBox.test.js.map
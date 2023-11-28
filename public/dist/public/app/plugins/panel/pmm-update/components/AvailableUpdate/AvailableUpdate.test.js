import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { AvailableUpdate } from './AvailableUpdate';
const nextFullVersion = 'x.y.z-rc.j+1234567890';
const nextVersion = 'x.y.z';
const newsLink = 'https://percona.com';
const nextVersionDate = '23 Jun';
const nextVersionDetails = {
    nextVersionDate,
    nextVersion,
    nextFullVersion,
    newsLink,
};
describe('AvailableUpdate::', () => {
    it('should show only the short version by default', () => {
        render(React.createElement(AvailableUpdate, { nextVersionDetails: nextVersionDetails }));
        expect(screen.getByTestId('update-latest-version').textContent).toEqual(nextVersion);
    });
    it('should show the news link if present', () => {
        render(React.createElement(AvailableUpdate, { nextVersionDetails: nextVersionDetails }));
        expect(screen.getByTestId('update-news-link')).toBeTruthy();
    });
    it('should show the full version on alt-click', () => {
        render(React.createElement(AvailableUpdate, { nextVersionDetails: nextVersionDetails }));
        fireEvent.click(screen.getByTestId('update-latest-section'), { altKey: true });
        expect(screen.getByTestId('update-latest-version').textContent).toEqual(nextFullVersion);
    });
});
//# sourceMappingURL=AvailableUpdate.test.js.map
import { __awaiter } from "tslib";
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CurrentVersion } from './CurrentVersion';
const installedFullVersion = 'x.y.z-rc.j+1234567890';
const installedVersion = 'x.y.z';
const installedVersionDate = '23 Jun';
const installedVersionDetails = {
    installedFullVersion,
    installedVersion,
    installedVersionDate,
};
describe('CurrentVersion::', () => {
    it('should show only the short version by default', () => __awaiter(void 0, void 0, void 0, function* () {
        const container = render(React.createElement(CurrentVersion, { installedVersionDetails: installedVersionDetails }));
        expect(container.baseElement.textContent).toBe(`Current version: ${installedVersion} (${installedVersionDate})`);
    }));
    it('should show the full version on alt-click', () => {
        const container = render(React.createElement(CurrentVersion, { installedVersionDetails: installedVersionDetails }));
        fireEvent.click(screen.getByTestId('update-installed-version'), { altKey: true });
        expect(container.baseElement.textContent).toBe(`Current version: ${installedFullVersion} (${installedVersionDate})`);
    });
});
//# sourceMappingURL=CurrentVersion.test.js.map
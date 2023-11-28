import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { reportInteraction } from '@grafana/runtime';
import { AngularDeprecationNotice } from './AngularDeprecationNotice';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { reportInteraction: jest.fn() })));
function localStorageKey(dsUid) {
    return `grafana.angularDeprecation.dashboardNotice.isDismissed.${dsUid}`;
}
describe('AngularDeprecationNotice', () => {
    const noticeText = /This dashboard depends on Angular/i;
    const dsUid = 'abc';
    afterAll(() => {
        jest.resetAllMocks();
    });
    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
    });
    it('should render', () => {
        render(React.createElement(AngularDeprecationNotice, { dashboardUid: dsUid }));
        expect(screen.getByText(noticeText)).toBeInTheDocument();
    });
    it('should be dismissable', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(AngularDeprecationNotice, { dashboardUid: dsUid }));
        const closeButton = screen.getByRole('button');
        expect(closeButton).toBeInTheDocument();
        yield userEvent.click(closeButton);
        expect(screen.queryByText(noticeText)).not.toBeInTheDocument();
    }));
    it('should persist dismission status in localstorage', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(AngularDeprecationNotice, { dashboardUid: dsUid }));
        expect(window.localStorage.getItem(localStorageKey(dsUid))).toBeNull();
        const closeButton = screen.getByRole('button');
        expect(closeButton).toBeInTheDocument();
        yield userEvent.click(closeButton);
        expect(window.localStorage.getItem(localStorageKey(dsUid))).toBe('true');
    }));
    it('should not re-render alert if already dismissed', () => {
        window.localStorage.setItem(localStorageKey(dsUid), 'true');
        render(React.createElement(AngularDeprecationNotice, { dashboardUid: dsUid }));
        expect(screen.queryByText(noticeText)).not.toBeInTheDocument();
    });
    it('should call reportInteraction when dismissing', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(AngularDeprecationNotice, { dashboardUid: dsUid }));
        const closeButton = screen.getByRole('button');
        expect(closeButton).toBeInTheDocument();
        yield userEvent.click(closeButton);
        expect(reportInteraction).toHaveBeenCalledWith('angular_deprecation_notice_dismissed');
    }));
});
//# sourceMappingURL=AngularDeprecationNotice.test.js.map
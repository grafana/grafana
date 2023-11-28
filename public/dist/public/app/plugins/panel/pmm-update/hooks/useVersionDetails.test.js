/* eslint-disable @typescript-eslint/no-explicit-any */
import { __awaiter } from "tslib";
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { useApiCall, useVersionDetails } from '../hooks';
const HookWrapper = () => {
    const [{ installedVersionDetails: { installedVersion, installedFullVersion, installedVersionDate }, lastCheckDate, nextVersionDetails: { nextVersion, nextFullVersion, nextVersionDate, newsLink }, isUpdateAvailable, }, errorMessage, isLoading, isDefaultView, getVersionDetails,] = useVersionDetails();
    return (React.createElement(React.Fragment, null,
        React.createElement("span", { "data-testid": "hook-wrapper-installed-version" }, installedVersion),
        React.createElement("span", { "data-testid": "hook-wrapper-installed-full-version" }, installedFullVersion),
        React.createElement("span", { "data-testid": "hook-wrapper-installed-date" }, installedVersionDate),
        React.createElement("span", { "data-testid": "hook-wrapper-last-check" }, lastCheckDate),
        React.createElement("span", { "data-testid": "hook-wrapper-next-version" }, nextVersion),
        React.createElement("span", { "data-testid": "hook-wrapper-next-full-version" }, nextFullVersion),
        React.createElement("span", { "data-testid": "hook-wrapper-next-date" }, nextVersionDate),
        React.createElement("span", { "data-testid": "hook-wrapper-next-news" }, newsLink),
        isUpdateAvailable && React.createElement("span", { "data-testid": "hook-wrapper-update-available" }),
        React.createElement("span", { "data-testid": "hook-wrapper-error" }, errorMessage),
        isLoading && React.createElement("span", { "data-testid": "hook-wrapper-loading" }),
        isDefaultView && React.createElement("span", { "data-testid": "hook-wrapper-default-view" }),
        React.createElement("button", { "data-testid": "hook-wrapper-update", onClick: () => getVersionDetails() })));
};
// NOTE (nicolalamacchia): this mock is here because some test cases alter it
jest.mock('./useApiCall', () => ({
    useApiCall: jest.fn(),
}));
const mockedUseApiCall = useApiCall;
const fakeData = {
    last_check: '2020-06-10T19:16:57Z',
    latest: {
        full_version: 'x.y.z-rc.j+1234567890',
        timestamp: '2020-06-09T19:16:57Z',
        version: 'x.y.z',
    },
    installed: {
        full_version: 'a.b.c-rc.i+0123456789',
        timestamp: '2020-06-08T19:16:57Z',
        version: 'a.b.c',
    },
    latest_news_url: 'https://percona.com',
    update_available: true,
};
const fakeDataUndefinedLeafs = {
    last_check: undefined,
    latest: {
        full_version: undefined,
        timestamp: undefined,
        version: undefined,
    },
    installed: {
        full_version: undefined,
        timestamp: undefined,
        version: undefined,
    },
    latest_news_url: undefined,
    update_available: undefined,
};
const emptyNextVersionDetails = {
    nextVersion: '',
    nextFullVersion: '',
    nextVersionDate: '',
    newsLink: '',
};
const emptyInstalledVersionDetails = {
    installedVersion: '',
    installedFullVersion: '',
    installedVersionDate: '',
};
const mockedApiCall = jest.fn();
const defaultMockedUseApiCallReturn = [undefined, '', true, mockedApiCall];
describe('useVersionDetails', () => {
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        // default mock
        mockedUseApiCall.mockImplementation(() => defaultMockedUseApiCallReturn);
    }));
    afterEach(() => {
        mockedUseApiCall.mockRestore();
        mockedApiCall.mockClear();
    });
    it('should return sane defaults when data is undefined', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(HookWrapper, null));
        expect(screen.getByTestId('hook-wrapper-installed-version').textContent).toBe(emptyInstalledVersionDetails.installedVersion);
        expect(screen.getByTestId('hook-wrapper-installed-full-version').textContent).toBe(emptyInstalledVersionDetails.installedFullVersion);
        expect(screen.getByTestId('hook-wrapper-installed-date').textContent).toBe(emptyInstalledVersionDetails.installedVersionDate);
        expect(screen.getByTestId('hook-wrapper-last-check').textContent).toBe('');
        expect(screen.getByTestId('hook-wrapper-next-version').textContent).toBe(emptyNextVersionDetails.nextVersion);
        expect(screen.getByTestId('hook-wrapper-next-full-version').textContent).toBe(emptyNextVersionDetails.nextFullVersion);
        expect(screen.getByTestId('hook-wrapper-next-date').textContent).toBe(emptyNextVersionDetails.nextVersionDate);
        expect(screen.getByTestId('hook-wrapper-next-news').textContent).toBe(emptyNextVersionDetails.newsLink);
        expect(screen.queryByTestId('hook-wrapper-update-available')).not.toBeInTheDocument();
        expect(screen.getByTestId('hook-wrapper-error').textContent).toBe(defaultMockedUseApiCallReturn[1]);
        expect(screen.queryByTestId('hook-wrapper-loading')).toBeInTheDocument();
        expect(screen.queryByTestId('hook-wrapper-default-view')).toBeInTheDocument();
    }));
    it('should return the correct fallbacks when the API call returns some undefined values', () => __awaiter(void 0, void 0, void 0, function* () {
        mockedUseApiCall.mockImplementation(() => [fakeDataUndefinedLeafs, '', false, mockedApiCall]);
        render(React.createElement(HookWrapper, null));
        expect(screen.getByTestId('hook-wrapper-installed-version').textContent).toBe(emptyInstalledVersionDetails.installedVersion);
        expect(screen.getByTestId('hook-wrapper-installed-full-version').textContent).toBe(emptyInstalledVersionDetails.installedFullVersion);
        expect(screen.getByTestId('hook-wrapper-installed-date').textContent).toBe(emptyInstalledVersionDetails.installedVersionDate);
        expect(screen.getByTestId('hook-wrapper-last-check').textContent).toBe('');
        expect(screen.getByTestId('hook-wrapper-next-version').textContent).toBe(emptyNextVersionDetails.nextVersion);
        expect(screen.getByTestId('hook-wrapper-next-full-version').textContent).toBe(emptyNextVersionDetails.nextFullVersion);
        expect(screen.getByTestId('hook-wrapper-next-date').textContent).toBe(emptyNextVersionDetails.nextVersionDate);
        expect(screen.getByTestId('hook-wrapper-next-news').textContent).toBe(emptyNextVersionDetails.newsLink);
        expect(screen.queryByTestId('hook-wrapper-update-available')).not.toBeInTheDocument();
        expect(screen.getByTestId('hook-wrapper-error').textContent).toBe('');
        expect(screen.queryByTestId('hook-wrapper-loading')).not.toBeInTheDocument();
        expect(screen.queryByTestId('hook-wrapper-default-view')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('hook-wrapper-update'));
    }));
    it('should return the correct values from the API call response', () => __awaiter(void 0, void 0, void 0, function* () {
        const expectedNextVersionDetails = {
            nextFullVersion: fakeData.latest.full_version,
            nextVersionDate: 'June 09, 2020',
            nextVersion: fakeData.latest.version,
            newsLink: 'https://percona.com',
        };
        const expectedInstalledVersionDetails = {
            installedFullVersion: fakeData.installed.full_version,
            installedVersionDate: 'June 08, 2020',
            installedVersion: fakeData.installed.version,
        };
        const newFakeData = Object.assign(Object.assign({}, fakeData), { latest: {
                full_version: fakeData.latest.full_version,
                version: fakeData.latest.version,
                timestamp: 'June 09, 2020',
            }, installed: {
                full_version: fakeData.installed.full_version,
                version: fakeData.installed.version,
                timestamp: 'June 08, 2020',
            }, latest_news_url: 'https://percona.com' });
        mockedUseApiCall.mockImplementation(() => [newFakeData, '', false, mockedApiCall]);
        render(React.createElement(HookWrapper, null));
        expect(screen.getByTestId('hook-wrapper-installed-version').textContent).toBe(expectedInstalledVersionDetails.installedVersion);
        expect(screen.getByTestId('hook-wrapper-installed-full-version').textContent).toBe(expectedInstalledVersionDetails.installedFullVersion);
        expect(screen.getByTestId('hook-wrapper-installed-date').textContent).toBe(expectedInstalledVersionDetails.installedVersionDate);
        expect(screen.getByTestId('hook-wrapper-last-check').textContent).toBe('June 10, 19:16');
        expect(screen.getByTestId('hook-wrapper-next-version').textContent).toBe(expectedNextVersionDetails.nextVersion);
        expect(screen.getByTestId('hook-wrapper-next-full-version').textContent).toBe(expectedNextVersionDetails.nextFullVersion);
        expect(screen.getByTestId('hook-wrapper-next-date').textContent).toBe(expectedNextVersionDetails.nextVersionDate);
        expect(screen.getByTestId('hook-wrapper-next-news').textContent).toBe(expectedNextVersionDetails.newsLink);
        expect(screen.queryByTestId('hook-wrapper-update-available')).toBeInTheDocument();
        expect(screen.getByTestId('hook-wrapper-error').textContent).toBe('');
        expect(screen.queryByTestId('hook-wrapper-loading')).not.toBeInTheDocument();
        expect(screen.queryByTestId('hook-wrapper-default-view')).not.toBeInTheDocument();
    }));
});
//# sourceMappingURL=useVersionDetails.test.js.map
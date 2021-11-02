import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { ApiKeysPageUnconnected } from './ApiKeysPage';
import { OrgRole } from 'app/types';
import { setSearchQuery } from './state/reducers';
import { mockToolkitActionCreator } from '../../../test/core/redux/mocks';
import { getMultipleMockKeys } from './__mocks__/apiKeysMock';
import { selectors } from '@grafana/e2e-selectors';
import userEvent from '@testing-library/user-event';
import { silenceConsoleOutput } from '../../../test/core/utils/silenceConsoleOutput';
var setup = function (propOverrides) {
    var loadApiKeysMock = jest.fn();
    var deleteApiKeyMock = jest.fn();
    var addApiKeyMock = jest.fn();
    var setSearchQueryMock = mockToolkitActionCreator(setSearchQuery);
    var props = {
        navModel: {
            main: {
                text: 'Configuration',
            },
            node: {
                text: 'Api Keys',
            },
        },
        apiKeys: [],
        searchQuery: '',
        hasFetched: false,
        loadApiKeys: loadApiKeysMock,
        deleteApiKey: deleteApiKeyMock,
        setSearchQuery: setSearchQueryMock,
        addApiKey: addApiKeyMock,
        apiKeysCount: 0,
        timeZone: 'utc',
    };
    Object.assign(props, propOverrides);
    var rerender = render(React.createElement(ApiKeysPageUnconnected, __assign({}, props))).rerender;
    return { rerender: rerender, props: props, loadApiKeysMock: loadApiKeysMock, setSearchQueryMock: setSearchQueryMock, deleteApiKeyMock: deleteApiKeyMock, addApiKeyMock: addApiKeyMock };
};
describe('ApiKeysPage', function () {
    silenceConsoleOutput();
    describe('when mounted', function () {
        it('then it should call loadApiKeys without expired', function () {
            var loadApiKeysMock = setup({}).loadApiKeysMock;
            expect(loadApiKeysMock).toHaveBeenCalledTimes(1);
            expect(loadApiKeysMock).toHaveBeenCalledWith(false);
        });
    });
    describe('when loading', function () {
        it('then should show Loading message', function () {
            setup({ hasFetched: false });
            expect(screen.getByText(/loading \.\.\./i)).toBeInTheDocument();
        });
    });
    describe('when there are no API keys', function () {
        it('then it should render CTA', function () {
            setup({ apiKeys: getMultipleMockKeys(0), apiKeysCount: 0, hasFetched: true });
            expect(screen.getByLabelText(selectors.components.CallToActionCard.button('New API key'))).toBeInTheDocument();
        });
    });
    describe('when there are API keys', function () {
        it('then it should render API keys table', function () { return __awaiter(void 0, void 0, void 0, function () {
            var apiKeys;
            return __generator(this, function (_a) {
                apiKeys = [
                    { id: 1, name: 'First', role: OrgRole.Admin, secondsToLive: 60, expiration: '2021-01-01' },
                    { id: 2, name: 'Second', role: OrgRole.Editor, secondsToLive: 60, expiration: '2021-01-02' },
                    { id: 3, name: 'Third', role: OrgRole.Viewer, secondsToLive: 0, expiration: undefined },
                ];
                setup({ apiKeys: apiKeys, apiKeysCount: apiKeys.length, hasFetched: true });
                expect(screen.getByRole('table')).toBeInTheDocument();
                expect(screen.getAllByRole('row').length).toBe(4);
                expect(screen.getByRole('row', { name: /first admin 2021-01-01 00:00:00 cancel delete/i })).toBeInTheDocument();
                expect(screen.getByRole('row', { name: /second editor 2021-01-02 00:00:00 cancel delete/i })).toBeInTheDocument();
                expect(screen.getByRole('row', { name: /third viewer no expiration date cancel delete/i })).toBeInTheDocument();
                return [2 /*return*/];
            });
        }); });
    });
    describe('when a user toggles the Show expired toggle', function () {
        it('then it should call loadApiKeys with correct parameters', function () { return __awaiter(void 0, void 0, void 0, function () {
            var apiKeys, loadApiKeysMock;
            return __generator(this, function (_a) {
                apiKeys = getMultipleMockKeys(3);
                loadApiKeysMock = setup({ apiKeys: apiKeys, apiKeysCount: apiKeys.length, hasFetched: true }).loadApiKeysMock;
                loadApiKeysMock.mockClear();
                toggleShowExpired();
                expect(loadApiKeysMock).toHaveBeenCalledTimes(1);
                expect(loadApiKeysMock).toHaveBeenCalledWith(true);
                loadApiKeysMock.mockClear();
                toggleShowExpired();
                expect(loadApiKeysMock).toHaveBeenCalledTimes(1);
                expect(loadApiKeysMock).toHaveBeenCalledWith(false);
                return [2 /*return*/];
            });
        }); });
    });
    describe('when a user searches for an API key', function () {
        it('then it should dispatch setSearchQuery with correct parameters', function () { return __awaiter(void 0, void 0, void 0, function () {
            var apiKeys, setSearchQueryMock;
            return __generator(this, function (_a) {
                apiKeys = getMultipleMockKeys(3);
                setSearchQueryMock = setup({ apiKeys: apiKeys, apiKeysCount: apiKeys.length, hasFetched: true }).setSearchQueryMock;
                setSearchQueryMock.mockClear();
                expect(screen.getByPlaceholderText(/search keys/i)).toBeInTheDocument();
                userEvent.type(screen.getByPlaceholderText(/search keys/i), 'First');
                expect(setSearchQueryMock).toHaveBeenCalledTimes(5);
                return [2 /*return*/];
            });
        }); });
    });
    describe('when a user deletes an API key', function () {
        it('then it should dispatch deleteApi with correct parameters', function () { return __awaiter(void 0, void 0, void 0, function () {
            var apiKeys, deleteApiKeyMock, firstRow, secondRow;
            return __generator(this, function (_a) {
                apiKeys = [
                    { id: 1, name: 'First', role: OrgRole.Admin, secondsToLive: 60, expiration: '2021-01-01' },
                    { id: 2, name: 'Second', role: OrgRole.Editor, secondsToLive: 60, expiration: '2021-01-02' },
                    { id: 3, name: 'Third', role: OrgRole.Viewer, secondsToLive: 0, expiration: undefined },
                ];
                deleteApiKeyMock = setup({ apiKeys: apiKeys, apiKeysCount: apiKeys.length, hasFetched: true }).deleteApiKeyMock;
                firstRow = screen.getByRole('row', { name: /first admin 2021-01-01 00:00:00 cancel delete/i });
                secondRow = screen.getByRole('row', { name: /second editor 2021-01-02 00:00:00 cancel delete/i });
                deleteApiKeyMock.mockClear();
                expect(within(firstRow).getByRole('cell', { name: /cancel delete/i })).toBeInTheDocument();
                userEvent.click(within(firstRow).getByRole('cell', { name: /cancel delete/i }));
                expect(within(firstRow).getByRole('button', { name: /delete$/i })).toBeInTheDocument();
                // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
                userEvent.click(within(firstRow).getByRole('button', { name: /delete$/i }), undefined, {
                    skipPointerEventsCheck: true,
                });
                expect(deleteApiKeyMock).toHaveBeenCalledTimes(1);
                expect(deleteApiKeyMock).toHaveBeenCalledWith(1, false);
                toggleShowExpired();
                deleteApiKeyMock.mockClear();
                expect(within(secondRow).getByRole('cell', { name: /cancel delete/i })).toBeInTheDocument();
                userEvent.click(within(secondRow).getByRole('cell', { name: /cancel delete/i }));
                expect(within(secondRow).getByRole('button', { name: /delete$/i })).toBeInTheDocument();
                // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
                userEvent.click(within(secondRow).getByRole('button', { name: /delete$/i }), undefined, {
                    skipPointerEventsCheck: true,
                });
                expect(deleteApiKeyMock).toHaveBeenCalledTimes(1);
                expect(deleteApiKeyMock).toHaveBeenCalledWith(2, true);
                return [2 /*return*/];
            });
        }); });
    });
    describe('when a user adds an API key from CTA', function () {
        it('then it should call addApiKey with correct parameters', function () { return __awaiter(void 0, void 0, void 0, function () {
            var apiKeys, addApiKeyMock;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        apiKeys = [];
                        addApiKeyMock = setup({ apiKeys: apiKeys, apiKeysCount: apiKeys.length, hasFetched: true }).addApiKeyMock;
                        addApiKeyMock.mockClear();
                        userEvent.click(screen.getByLabelText(selectors.components.CallToActionCard.button('New API key')));
                        return [4 /*yield*/, addAndVerifyApiKey(addApiKeyMock, false)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when a user adds an API key from Add API key', function () {
        it('then it should call addApiKey with correct parameters', function () { return __awaiter(void 0, void 0, void 0, function () {
            var apiKeys, addApiKeyMock;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        apiKeys = getMultipleMockKeys(1);
                        addApiKeyMock = setup({ apiKeys: apiKeys, apiKeysCount: apiKeys.length, hasFetched: true }).addApiKeyMock;
                        addApiKeyMock.mockClear();
                        userEvent.click(screen.getByRole('button', { name: /add api key/i }));
                        return [4 /*yield*/, addAndVerifyApiKey(addApiKeyMock, false)];
                    case 1:
                        _a.sent();
                        toggleShowExpired();
                        addApiKeyMock.mockClear();
                        userEvent.click(screen.getByRole('button', { name: /add api key/i }));
                        return [4 /*yield*/, addAndVerifyApiKey(addApiKeyMock, true)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when a user adds an API key with an invalid expiration', function () {
        it('then it should display a message', function () { return __awaiter(void 0, void 0, void 0, function () {
            var apiKeys, addApiKeyMock;
            return __generator(this, function (_a) {
                apiKeys = getMultipleMockKeys(1);
                addApiKeyMock = setup({ apiKeys: apiKeys, apiKeysCount: apiKeys.length, hasFetched: true }).addApiKeyMock;
                addApiKeyMock.mockClear();
                userEvent.click(screen.getByRole('button', { name: /add api key/i }));
                userEvent.type(screen.getByPlaceholderText(/name/i), 'Test');
                userEvent.type(screen.getByPlaceholderText(/1d/i), '60x');
                expect(screen.queryByText(/not a valid duration/i)).not.toBeInTheDocument();
                userEvent.click(screen.getByRole('button', { name: /^add$/i }));
                expect(screen.getByText(/not a valid duration/i)).toBeInTheDocument();
                expect(addApiKeyMock).toHaveBeenCalledTimes(0);
                return [2 /*return*/];
            });
        }); });
    });
});
function toggleShowExpired() {
    expect(screen.queryByLabelText(/show expired/i)).toBeInTheDocument();
    userEvent.click(screen.getByLabelText(/show expired/i));
}
function addAndVerifyApiKey(addApiKeyMock, includeExpired) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            expect(screen.getByRole('heading', { name: /add api key/i })).toBeInTheDocument();
            expect(screen.getByPlaceholderText(/name/i)).toBeInTheDocument();
            expect(screen.getByPlaceholderText(/1d/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument();
            userEvent.type(screen.getByPlaceholderText(/name/i), 'Test');
            userEvent.type(screen.getByPlaceholderText(/1d/i), '60s');
            userEvent.click(screen.getByRole('button', { name: /^add$/i }));
            expect(addApiKeyMock).toHaveBeenCalledTimes(1);
            expect(addApiKeyMock).toHaveBeenCalledWith({ name: 'Test', role: 'Viewer', secondsToLive: 60 }, expect.anything(), includeExpired);
            return [2 /*return*/];
        });
    });
}
//# sourceMappingURL=ApiKeysPage.test.js.map
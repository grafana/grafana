import { __awaiter } from "tslib";
import { render, screen, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { OrgRole } from 'app/types';
import { mockToolkitActionCreator } from '../../../test/core/redux/mocks';
import { silenceConsoleOutput } from '../../../test/core/utils/silenceConsoleOutput';
import { ApiKeysPageUnconnected } from './ApiKeysPage';
import { getMultipleMockKeys } from './__mocks__/apiKeysMock';
import { setSearchQuery } from './state/reducers';
jest.mock('app/core/core', () => {
    return {
        contextSrv: {
            hasPermission: () => true,
            hasPermissionInMetadata: () => true,
        },
    };
});
const setup = (propOverrides) => {
    const loadApiKeysMock = jest.fn();
    const deleteApiKeyMock = jest.fn();
    const migrateApiKeyMock = jest.fn();
    const addApiKeyMock = jest.fn();
    const migrateAllMock = jest.fn();
    const toggleIncludeExpiredMock = jest.fn();
    const setSearchQueryMock = mockToolkitActionCreator(setSearchQuery);
    const props = {
        apiKeys: [],
        searchQuery: '',
        hasFetched: false,
        loadApiKeys: loadApiKeysMock,
        deleteApiKey: deleteApiKeyMock,
        setSearchQuery: setSearchQueryMock,
        migrateApiKey: migrateApiKeyMock,
        migrateAll: migrateAllMock,
        apiKeysCount: 0,
        timeZone: 'utc',
        includeExpired: false,
        includeExpiredDisabled: false,
        toggleIncludeExpired: toggleIncludeExpiredMock,
        canCreate: true,
        migrationResult: undefined,
    };
    Object.assign(props, propOverrides);
    const { rerender } = render(React.createElement(TestProvider, null,
        React.createElement(ApiKeysPageUnconnected, Object.assign({}, props))));
    return {
        rerender: (element) => rerender(React.createElement(TestProvider, null, element)),
        props,
        loadApiKeysMock,
        setSearchQueryMock,
        deleteApiKeyMock,
        addApiKeyMock,
        toggleIncludeExpiredMock,
    };
};
describe('ApiKeysPage', () => {
    silenceConsoleOutput();
    describe('when mounted', () => {
        it('then it should call loadApiKeys', () => {
            const { loadApiKeysMock } = setup({});
            expect(loadApiKeysMock).toHaveBeenCalledTimes(1);
        });
    });
    describe('when loading', () => {
        it('then should show Loading message', () => {
            setup({ hasFetched: false });
            expect(screen.getByText(/loading \.\.\./i)).toBeInTheDocument();
        });
    });
    describe('when there are API keys', () => {
        it('then it should render API keys table', () => __awaiter(void 0, void 0, void 0, function* () {
            const apiKeys = [
                { id: 1, name: 'First', role: OrgRole.Admin, secondsToLive: 60, expiration: '2021-01-01' },
                { id: 2, name: 'Second', role: OrgRole.Editor, secondsToLive: 60, expiration: '2021-01-02' },
                { id: 3, name: 'Third', role: OrgRole.Viewer, secondsToLive: 0, expiration: undefined },
            ];
            setup({ apiKeys, apiKeysCount: apiKeys.length, hasFetched: true });
            expect(screen.getByRole('table')).toBeInTheDocument();
            expect(screen.getAllByRole('row').length).toBe(4);
            expect(screen.getByRole('row', { name: /first admin 2021-01-01 00:00:00/i })).toBeInTheDocument();
            expect(screen.getByRole('row', { name: /second editor 2021-01-02 00:00:00/i })).toBeInTheDocument();
            expect(screen.getByRole('row', { name: /third viewer no expiration date/i })).toBeInTheDocument();
        }));
    });
    describe('when a user toggles the Show expired toggle', () => {
        it('then it should dispatch toggleIncludeExpired', () => __awaiter(void 0, void 0, void 0, function* () {
            const apiKeys = getMultipleMockKeys(3);
            const { toggleIncludeExpiredMock } = setup({ apiKeys, apiKeysCount: apiKeys.length, hasFetched: true });
            yield toggleShowExpired();
            expect(toggleIncludeExpiredMock).toHaveBeenCalledTimes(1);
        }));
    });
    describe('when a user searches for an API key', () => {
        it('then it should dispatch setSearchQuery with correct parameters', () => __awaiter(void 0, void 0, void 0, function* () {
            const apiKeys = getMultipleMockKeys(3);
            const { setSearchQueryMock } = setup({ apiKeys, apiKeysCount: apiKeys.length, hasFetched: true });
            setSearchQueryMock.mockClear();
            expect(screen.getByPlaceholderText(/search keys/i)).toBeInTheDocument();
            yield userEvent.type(screen.getByPlaceholderText(/search keys/i), 'First');
            expect(setSearchQueryMock).toHaveBeenCalledTimes(5);
        }));
    });
    describe('when a user deletes an API key', () => {
        it('then it should dispatch deleteApi with correct parameters', () => __awaiter(void 0, void 0, void 0, function* () {
            const apiKeys = [
                { id: 1, name: 'First', role: OrgRole.Admin, secondsToLive: 60, expiration: '2021-01-01' },
                { id: 2, name: 'Second', role: OrgRole.Editor, secondsToLive: 60, expiration: '2021-01-02' },
                { id: 3, name: 'Third', role: OrgRole.Viewer, secondsToLive: 0, expiration: undefined },
            ];
            const { deleteApiKeyMock } = setup({ apiKeys, apiKeysCount: apiKeys.length, hasFetched: true });
            const firstRow = screen.getByRole('row', { name: /first admin 2021-01-01 00:00:00/i });
            const secondRow = screen.getByRole('row', { name: /second editor 2021-01-02 00:00:00/i });
            deleteApiKeyMock.mockClear();
            expect(within(firstRow).getByLabelText('Delete API key')).toBeInTheDocument();
            yield userEvent.click(within(firstRow).getByLabelText('Delete API key'));
            expect(within(firstRow).getByRole('button', { name: /delete$/i })).toBeInTheDocument();
            yield userEvent.click(within(firstRow).getByRole('button', { name: /delete$/i }));
            expect(deleteApiKeyMock).toHaveBeenCalledTimes(1);
            expect(deleteApiKeyMock).toHaveBeenCalledWith(1);
            yield toggleShowExpired();
            deleteApiKeyMock.mockClear();
            expect(within(secondRow).getByLabelText('Delete API key')).toBeInTheDocument();
            yield userEvent.click(within(secondRow).getByLabelText('Delete API key'));
            expect(within(secondRow).getByRole('button', { name: /delete$/i })).toBeInTheDocument();
            yield userEvent.click(within(secondRow).getByRole('button', { name: /delete$/i }), {
                pointerEventsCheck: PointerEventsCheckLevel.Never,
            });
            expect(deleteApiKeyMock).toHaveBeenCalledTimes(1);
            expect(deleteApiKeyMock).toHaveBeenCalledWith(2);
        }));
    });
});
function toggleShowExpired() {
    return __awaiter(this, void 0, void 0, function* () {
        expect(screen.queryByLabelText(/include expired keys/i)).toBeInTheDocument();
        yield userEvent.click(screen.getByLabelText(/include expired keys/i));
    });
}
//# sourceMappingURL=ApiKeysPage.test.js.map
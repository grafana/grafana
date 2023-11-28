import { __awaiter } from "tslib";
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { getSelectParent, selectOptionInTest } from 'test/helpers/selectOptionInTest';
import SharedPreferences from './SharedPreferences';
jest.mock('app/core/services/backend_srv', () => {
    return {
        backendSrv: {
            getDashboardByUid: jest.fn().mockResolvedValue({
                dashboard: {
                    id: 2,
                    title: 'My Dashboard',
                    uid: 'myDash',
                    templating: {
                        list: [],
                    },
                    panels: [],
                },
                meta: {},
            }),
            search: jest.fn().mockResolvedValue([
                {
                    id: 2,
                    title: 'My Dashboard',
                    tags: [],
                    type: '',
                    uid: 'myDash',
                    uri: '',
                    url: '',
                    folderId: 0,
                    folderTitle: '',
                    folderUid: '',
                    folderUrl: '',
                    isStarred: true,
                    slug: '',
                    items: [],
                },
                {
                    id: 3,
                    title: 'Another Dashboard',
                    tags: [],
                    type: '',
                    uid: 'anotherDash',
                    uri: '',
                    url: '',
                    folderId: 0,
                    folderTitle: '',
                    folderUid: '',
                    folderUrl: '',
                    isStarred: true,
                    slug: '',
                    items: [],
                },
            ]),
        },
    };
});
const mockPreferences = {
    timezone: 'browser',
    weekStart: 'monday',
    theme: 'light',
    homeDashboardUID: 'myDash',
    queryHistory: {
        homeTab: '',
    },
    language: '',
};
const defaultPreferences = {
    timezone: '',
    weekStart: '',
    theme: '',
    homeDashboardUID: '',
    queryHistory: {
        homeTab: '',
    },
    language: '',
};
const mockPrefsPatch = jest.fn();
const mockPrefsUpdate = jest.fn();
const mockPrefsLoad = jest.fn().mockResolvedValue(mockPreferences);
jest.mock('app/core/services/PreferencesService', () => ({
    PreferencesService: function () {
        return {
            patch: mockPrefsPatch,
            update: mockPrefsUpdate,
            load: mockPrefsLoad,
        };
    },
}));
const props = {
    resourceUri: '/fake-api/user/1',
    preferenceType: 'user',
};
describe('SharedPreferences', () => {
    const original = window.location;
    const mockReload = jest.fn();
    beforeAll(() => {
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { reload: mockReload },
        });
    });
    afterAll(() => {
        Object.defineProperty(window, 'location', { configurable: true, value: original });
    });
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        mockReload.mockReset();
        mockPrefsUpdate.mockReset();
        render(React.createElement(SharedPreferences, Object.assign({}, props)));
        yield waitFor(() => expect(mockPrefsLoad).toHaveBeenCalled());
    }));
    it('renders the theme preference', () => {
        const themeSelect = getSelectParent(screen.getByLabelText('Interface theme'));
        expect(themeSelect).toHaveTextContent('Light');
    });
    it('renders the home dashboard preference', () => __awaiter(void 0, void 0, void 0, function* () {
        const dashboardSelect = getSelectParent(screen.getByLabelText('Home Dashboard'));
        yield waitFor(() => {
            expect(dashboardSelect).toHaveTextContent('My Dashboard');
        });
    }));
    it('renders the timezone preference', () => {
        const tzSelect = getSelectParent(screen.getByLabelText('Timezone'));
        expect(tzSelect).toHaveTextContent('Browser Time');
    });
    it('renders the week start preference', () => __awaiter(void 0, void 0, void 0, function* () {
        const weekSelect = getSelectParent(screen.getByLabelText('Week start'));
        expect(weekSelect).toHaveTextContent('Monday');
    }));
    it('renders the language preference', () => __awaiter(void 0, void 0, void 0, function* () {
        const weekSelect = getSelectParent(screen.getByLabelText(/language/i));
        expect(weekSelect).toHaveTextContent('Default');
    }));
    it('saves the users new preferences', () => __awaiter(void 0, void 0, void 0, function* () {
        yield selectOptionInTest(screen.getByLabelText('Interface theme'), 'Dark');
        yield selectOptionInTest(screen.getByLabelText('Timezone'), 'Australia/Sydney');
        yield selectOptionInTest(screen.getByLabelText('Week start'), 'Saturday');
        yield selectOptionInTest(screen.getByLabelText(/language/i), 'Français');
        yield userEvent.click(screen.getByText('Save'));
        expect(mockPrefsUpdate).toHaveBeenCalledWith({
            timezone: 'Australia/Sydney',
            weekStart: 'saturday',
            theme: 'dark',
            homeDashboardUID: 'myDash',
            queryHistory: {
                homeTab: '',
            },
            language: 'fr-FR',
        });
    }));
    it('saves the users default preferences', () => __awaiter(void 0, void 0, void 0, function* () {
        yield selectOptionInTest(screen.getByLabelText('Interface theme'), 'Default');
        // there's no default option in this dropdown - there's a clear selection button
        // get the parent container, and find the "select-clear-value" button
        const dashboardSelect = screen.getByTestId('User preferences home dashboard drop down');
        yield userEvent.click(within(dashboardSelect).getByRole('button', { name: 'select-clear-value' }));
        yield selectOptionInTest(screen.getByLabelText('Timezone'), 'Default');
        yield selectOptionInTest(screen.getByLabelText('Week start'), 'Default');
        yield selectOptionInTest(screen.getByLabelText(/language/i), 'Default');
        yield userEvent.click(screen.getByText('Save'));
        expect(mockPrefsUpdate).toHaveBeenCalledWith(defaultPreferences);
    }));
    it('refreshes the page after saving preferences', () => __awaiter(void 0, void 0, void 0, function* () {
        yield userEvent.click(screen.getByText('Save'));
        expect(mockReload).toHaveBeenCalled();
    }));
});
//# sourceMappingURL=SharedPreferences.test.js.map
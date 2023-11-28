import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import { DataFrameView, FieldType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getGrafanaSearcher } from '../../service';
import { getSearchStateManager, initialState } from '../../state/SearchStateManager';
import { DashboardSearchItemType, SearchLayout } from '../../types';
import { SearchView } from './SearchView';
jest.mock('@grafana/runtime', () => {
    const originalModule = jest.requireActual('@grafana/runtime');
    return Object.assign(Object.assign({}, originalModule), { reportInteraction: jest.fn() });
});
const stateManager = getSearchStateManager();
const setup = (propOverrides, stateOverrides) => {
    const props = Object.assign({ showManage: false, keyboardEvents: {} }, propOverrides);
    stateManager.setState(Object.assign(Object.assign({}, initialState), stateOverrides));
    const mockStore = configureMockStore();
    const store = mockStore({ searchQuery: Object.assign({}, initialState) });
    render(React.createElement(Provider, { store: store },
        React.createElement(SearchView, Object.assign({}, props))));
};
describe('SearchView', () => {
    const folderData = {
        fields: [
            {
                name: 'kind',
                type: FieldType.string,
                config: {},
                values: [DashboardSearchItemType.DashFolder],
            },
            { name: 'name', type: FieldType.string, config: {}, values: ['My folder 1'] },
            { name: 'uid', type: FieldType.string, config: {}, values: ['my-folder-1'] },
            { name: 'url', type: FieldType.string, config: {}, values: ['/my-folder-1'] },
        ],
        length: 1,
    };
    const mockSearchResult = {
        isItemLoaded: jest.fn(),
        loadMoreItems: jest.fn(),
        totalRows: folderData.length,
        view: new DataFrameView(folderData),
    };
    beforeAll(() => {
        jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(mockSearchResult);
    });
    beforeEach(() => {
        config.featureToggles.panelTitleSearch = false;
    });
    it('does not show checkboxes or manage actions if showManage is false', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        yield waitFor(() => expect(screen.queryAllByRole('checkbox')).toHaveLength(0));
        expect(screen.queryByTestId('manage-actions')).not.toBeInTheDocument();
    }));
    it('shows checkboxes if showManage is true', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ showManage: true });
        yield waitFor(() => expect(screen.queryAllByRole('checkbox')).toHaveLength(2));
    }));
    it('shows the manage actions if show manage is true and the user clicked a checkbox', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ showManage: true });
        yield waitFor(() => userEvent.click(screen.getAllByRole('checkbox')[0]));
        expect(screen.queryByTestId('manage-actions')).toBeInTheDocument();
    }));
    it('shows an empty state if no data returned', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(Object.assign(Object.assign({}, mockSearchResult), { totalRows: 0, view: new DataFrameView({ fields: [], length: 0 }) }));
        setup(undefined, { query: 'asdfasdfasdf' });
        yield waitFor(() => expect(screen.queryByText('No results found for your query.')).toBeInTheDocument());
        expect(screen.getByRole('button', { name: 'Clear search and filters' })).toBeInTheDocument();
    }));
    it('shows an empty state if no starred dashboard returned', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(Object.assign(Object.assign({}, mockSearchResult), { totalRows: 0, view: new DataFrameView({ fields: [], length: 0 }) }));
        setup(undefined, { starred: true });
        yield waitFor(() => expect(screen.queryByText('No results found for your query.')).toBeInTheDocument());
        expect(screen.getByRole('button', { name: 'Clear search and filters' })).toBeInTheDocument();
    }));
    it('shows empty folder cta for empty folder', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(Object.assign(Object.assign({}, mockSearchResult), { totalRows: 0, view: new DataFrameView({ fields: [], length: 0 }) }));
        setup({
            folderDTO: {
                id: 1,
                uid: 'abc',
                title: 'morning coffee',
                url: '/morningcoffee',
                version: 1,
                canSave: true,
                canEdit: true,
                canAdmin: true,
                canDelete: true,
                created: '',
                createdBy: '',
                hasAcl: false,
                updated: '',
                updatedBy: '',
            },
        }, undefined);
        yield waitFor(() => expect(screen.queryByText("This folder doesn't have any dashboards yet")).toBeInTheDocument());
    }));
    describe('include panels', () => {
        it('should be enabled when layout is list', () => __awaiter(void 0, void 0, void 0, function* () {
            config.featureToggles.panelTitleSearch = true;
            setup({}, { layout: SearchLayout.List });
            yield waitFor(() => expect(screen.getByLabelText(/include panels/i)).toBeInTheDocument());
            expect(screen.getByTestId('include-panels')).toBeEnabled();
        }));
        it('should be disabled when layout is folder', () => __awaiter(void 0, void 0, void 0, function* () {
            config.featureToggles.panelTitleSearch = true;
            setup({}, { layout: SearchLayout.Folders });
            yield waitFor(() => expect(screen.getByLabelText(/include panels/i)).toBeInTheDocument());
            expect(screen.getByTestId('include-panels')).toBeDisabled();
        }));
    });
});
//# sourceMappingURL=SearchView.test.js.map
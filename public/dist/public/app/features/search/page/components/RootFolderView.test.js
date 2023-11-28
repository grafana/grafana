import { __awaiter } from "tslib";
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { DataFrameView, FieldType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { ContextSrv, setContextSrv } from '../../../../core/services/context_srv';
import impressionSrv from '../../../../core/services/impression_srv';
import { getGrafanaSearcher } from '../../service';
import { DashboardSearchItemType } from '../../types';
import { RootFolderView } from './RootFolderView';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => ({
        get: jest.fn().mockResolvedValue(['foo']),
    }) })));
describe('RootFolderView', () => {
    let grafanaSearcherSpy;
    const mockOnTagSelected = jest.fn();
    const mockSelectionToggle = jest.fn();
    const mockSelection = jest.fn();
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
    let contextSrv;
    beforeAll(() => {
        contextSrv = new ContextSrv();
        setContextSrv(contextSrv);
        grafanaSearcherSpy = jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(mockSearchResult);
    });
    // need to make sure we clear localStorage
    // otherwise tests can interfere with each other and the starting expanded state of the component
    afterEach(() => {
        window.localStorage.clear();
    });
    it('shows a spinner whilst the results are loading', () => __awaiter(void 0, void 0, void 0, function* () {
        // mock the query promise so we can resolve manually
        let promiseResolver;
        const promise = new Promise((resolve) => {
            promiseResolver = resolve;
        });
        grafanaSearcherSpy.mockImplementationOnce(() => promise);
        render(React.createElement(RootFolderView, { onTagSelected: mockOnTagSelected, selection: mockSelection, selectionToggle: mockSelectionToggle }));
        expect(yield screen.findByTestId('Spinner')).toBeInTheDocument();
        // resolve the promise
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            promiseResolver(mockSearchResult);
        }));
        expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
    }));
    it('does not show the starred items if not signed in', () => __awaiter(void 0, void 0, void 0, function* () {
        contextSrv.isSignedIn = false;
        render(React.createElement(RootFolderView, { onTagSelected: mockOnTagSelected, selection: mockSelection, selectionToggle: mockSelectionToggle }));
        expect((yield screen.findAllByTestId(selectors.components.Search.sectionV2))[0]).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Starred' })).not.toBeInTheDocument();
    }));
    it('shows the starred items if signed in', () => __awaiter(void 0, void 0, void 0, function* () {
        contextSrv.isSignedIn = true;
        render(React.createElement(RootFolderView, { onTagSelected: mockOnTagSelected, selection: mockSelection, selectionToggle: mockSelectionToggle }));
        expect(yield screen.findByRole('button', { name: 'Starred' })).toBeInTheDocument();
    }));
    it('does not show the recent items if no dashboards have been opened recently', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(impressionSrv, 'getDashboardOpened').mockResolvedValue([]);
        render(React.createElement(RootFolderView, { onTagSelected: mockOnTagSelected, selection: mockSelection, selectionToggle: mockSelectionToggle }));
        expect((yield screen.findAllByTestId(selectors.components.Search.sectionV2))[0]).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Recent' })).not.toBeInTheDocument();
    }));
    it('shows the recent items if any dashboards have recently been opened', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(impressionSrv, 'getDashboardOpened').mockResolvedValue(['7MeksYbmk']);
        render(React.createElement(RootFolderView, { onTagSelected: mockOnTagSelected, selection: mockSelection, selectionToggle: mockSelectionToggle }));
        expect(yield screen.findByRole('button', { name: 'Recent' })).toBeInTheDocument();
    }));
    it('shows the general folder by default', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(RootFolderView, { onTagSelected: mockOnTagSelected, selection: mockSelection, selectionToggle: mockSelectionToggle }));
        expect(yield screen.findByRole('button', { name: 'General' })).toBeInTheDocument();
    }));
    describe('when hidePseudoFolders is set', () => {
        it('does not show the starred items even if signed in', () => __awaiter(void 0, void 0, void 0, function* () {
            contextSrv.isSignedIn = true;
            render(React.createElement(RootFolderView, { hidePseudoFolders: true, onTagSelected: mockOnTagSelected, selection: mockSelection, selectionToggle: mockSelectionToggle }));
            expect(yield screen.findByRole('button', { name: 'General' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Starred' })).not.toBeInTheDocument();
        }));
        it('does not show the recent items even if recent dashboards have been opened', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(impressionSrv, 'getDashboardOpened').mockResolvedValue(['7MeksYbmk']);
            render(React.createElement(RootFolderView, { hidePseudoFolders: true, onTagSelected: mockOnTagSelected, selection: mockSelection, selectionToggle: mockSelectionToggle }));
            expect(yield screen.findByRole('button', { name: 'General' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Recent' })).not.toBeInTheDocument();
        }));
    });
    it('shows an error state if any of the calls reject for a specific reason', () => __awaiter(void 0, void 0, void 0, function* () {
        // reject with a specific Error object
        grafanaSearcherSpy.mockRejectedValueOnce(new Error('Uh oh spagghettios!'));
        render(React.createElement(RootFolderView, { onTagSelected: mockOnTagSelected, selection: mockSelection, selectionToggle: mockSelectionToggle }));
        expect(yield screen.findByRole('alert', { name: 'Uh oh spagghettios!' })).toBeInTheDocument();
    }));
    it('shows a general error state if any of the calls reject', () => __awaiter(void 0, void 0, void 0, function* () {
        // reject with nothing
        grafanaSearcherSpy.mockRejectedValueOnce(null);
        render(React.createElement(RootFolderView, { onTagSelected: mockOnTagSelected, selection: mockSelection, selectionToggle: mockSelectionToggle }));
        expect(yield screen.findByRole('alert', { name: 'Something went wrong' })).toBeInTheDocument();
    }));
});
//# sourceMappingURL=RootFolderView.test.js.map
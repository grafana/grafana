import { __awaiter } from "tslib";
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { DataFrameView, FieldType } from '@grafana/data';
import { getGrafanaSearcher } from '../../service';
import { DashboardSearchItemType } from '../../types';
import { FolderSection } from './FolderSection';
describe('FolderSection', () => {
    let grafanaSearcherSpy;
    const mockOnTagSelected = jest.fn();
    const mockSelectionToggle = jest.fn();
    const mockSelection = jest.fn();
    const mockSection = {
        kind: 'folder',
        uid: 'my-folder',
        title: 'My folder',
    };
    // need to make sure we clear localStorage
    // otherwise tests can interfere with each other and the starting expanded state of the component
    afterEach(() => {
        window.localStorage.clear();
    });
    describe('when there are no results', () => {
        const emptySearchData = {
            fields: [
                { name: 'kind', type: FieldType.string, config: {}, values: [] },
                { name: 'name', type: FieldType.string, config: {}, values: [] },
                { name: 'uid', type: FieldType.string, config: {}, values: [] },
                { name: 'url', type: FieldType.string, config: {}, values: [] },
                { name: 'tags', type: FieldType.other, config: {}, values: [] },
                { name: 'location', type: FieldType.string, config: {}, values: [] },
            ],
            length: 0,
        };
        const mockSearchResult = {
            isItemLoaded: jest.fn(),
            loadMoreItems: jest.fn(),
            totalRows: emptySearchData.length,
            view: new DataFrameView(emptySearchData),
        };
        beforeAll(() => {
            grafanaSearcherSpy = jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(mockSearchResult);
        });
        it('shows the folder title as the header', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(FolderSection, { section: mockSection, onTagSelected: mockOnTagSelected }));
            expect(yield screen.findByRole('button', { name: mockSection.title })).toBeInTheDocument();
        }));
        describe('when renderStandaloneBody is set', () => {
            it('shows a "No results found" message and does not show the folder title header', () => __awaiter(void 0, void 0, void 0, function* () {
                render(React.createElement(FolderSection, { renderStandaloneBody: true, section: mockSection, onTagSelected: mockOnTagSelected }));
                expect(yield screen.findByText('No results found')).toBeInTheDocument();
                expect(screen.queryByRole('button', { name: mockSection.title })).not.toBeInTheDocument();
            }));
            it('renders a loading spinner whilst waiting for the results', () => __awaiter(void 0, void 0, void 0, function* () {
                // mock the query promise so we can resolve manually
                let promiseResolver;
                const promise = new Promise((resolve) => {
                    promiseResolver = resolve;
                });
                grafanaSearcherSpy.mockImplementationOnce(() => promise);
                render(React.createElement(FolderSection, { renderStandaloneBody: true, section: mockSection, onTagSelected: mockOnTagSelected }));
                expect(yield screen.findByTestId('Spinner')).toBeInTheDocument();
                // resolve the promise
                yield act(() => __awaiter(void 0, void 0, void 0, function* () {
                    promiseResolver(mockSearchResult);
                }));
                expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
                expect(yield screen.findByText('No results found')).toBeInTheDocument();
            }));
        });
        it('shows a "No results found" message when expanding the folder', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(FolderSection, { section: mockSection, onTagSelected: mockOnTagSelected }));
            yield userEvent.click(yield screen.findByRole('button', { name: mockSection.title }));
            expect(getGrafanaSearcher().search).toHaveBeenCalled();
            expect(yield screen.findByText('No results found')).toBeInTheDocument();
        }));
    });
    describe('when there are results', () => {
        const searchData = {
            fields: [
                { name: 'kind', type: FieldType.string, config: {}, values: [DashboardSearchItemType.DashDB] },
                { name: 'name', type: FieldType.string, config: {}, values: ['My dashboard 1'] },
                { name: 'uid', type: FieldType.string, config: {}, values: ['my-dashboard-1'] },
                { name: 'url', type: FieldType.string, config: {}, values: ['/my-dashboard-1'] },
                { name: 'tags', type: FieldType.other, config: {}, values: [['foo', 'bar']] },
                { name: 'location', type: FieldType.string, config: {}, values: ['my-folder-1'] },
            ],
            meta: {
                custom: {
                    locationInfo: {
                        'my-folder-1': {
                            name: 'My folder 1',
                            kind: 'folder',
                            url: '/my-folder-1',
                        },
                    },
                },
            },
            length: 1,
        };
        const mockSearchResult = {
            isItemLoaded: jest.fn(),
            loadMoreItems: jest.fn(),
            totalRows: searchData.length,
            view: new DataFrameView(searchData),
        };
        beforeAll(() => {
            grafanaSearcherSpy = jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(mockSearchResult);
        });
        it('shows the folder title as the header', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(FolderSection, { section: mockSection, onTagSelected: mockOnTagSelected }));
            expect(yield screen.findByRole('button', { name: mockSection.title })).toBeInTheDocument();
        }));
        describe('when renderStandaloneBody is set', () => {
            it('shows the folder children and does not render the folder title', () => __awaiter(void 0, void 0, void 0, function* () {
                render(React.createElement(FolderSection, { renderStandaloneBody: true, section: mockSection, onTagSelected: mockOnTagSelected }));
                expect(yield screen.findByText('My dashboard 1')).toBeInTheDocument();
                expect(screen.queryByRole('button', { name: mockSection.title })).not.toBeInTheDocument();
            }));
            it('renders a loading spinner whilst waiting for the results', () => __awaiter(void 0, void 0, void 0, function* () {
                // mock the query promise so we can resolve manually
                let promiseResolver;
                const promise = new Promise((resolve) => {
                    promiseResolver = resolve;
                });
                grafanaSearcherSpy.mockImplementationOnce(() => promise);
                render(React.createElement(FolderSection, { renderStandaloneBody: true, section: mockSection, onTagSelected: mockOnTagSelected }));
                expect(yield screen.findByTestId('Spinner')).toBeInTheDocument();
                // resolve the promise
                yield act(() => __awaiter(void 0, void 0, void 0, function* () {
                    promiseResolver(mockSearchResult);
                }));
                expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
                expect(yield screen.findByText('My dashboard 1')).toBeInTheDocument();
            }));
        });
        it('shows the folder contents when expanding the folder', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(FolderSection, { section: mockSection, onTagSelected: mockOnTagSelected }));
            yield userEvent.click(yield screen.findByRole('button', { name: mockSection.title }));
            expect(getGrafanaSearcher().search).toHaveBeenCalled();
            expect(yield screen.findByText('My dashboard 1')).toBeInTheDocument();
        }));
        describe('when clicking the checkbox', () => {
            it('does not expand the section', () => __awaiter(void 0, void 0, void 0, function* () {
                render(React.createElement(FolderSection, { section: mockSection, selection: mockSelection, selectionToggle: mockSelectionToggle, onTagSelected: mockOnTagSelected }));
                yield userEvent.click(yield screen.findByRole('checkbox', { name: 'Select folder' }));
                expect(screen.queryByText('My dashboard 1')).not.toBeInTheDocument();
            }));
            it('selects only the folder if the folder is not expanded', () => __awaiter(void 0, void 0, void 0, function* () {
                render(React.createElement(FolderSection, { section: mockSection, selection: mockSelection, selectionToggle: mockSelectionToggle, onTagSelected: mockOnTagSelected }));
                yield userEvent.click(yield screen.findByRole('checkbox', { name: 'Select folder' }));
                expect(mockSelectionToggle).toHaveBeenCalledWith('folder', 'my-folder');
                expect(mockSelectionToggle).not.toHaveBeenCalledWith('dashboard', 'my-dashboard-1');
            }));
            it('selects the folder and all children when the folder is expanded', () => __awaiter(void 0, void 0, void 0, function* () {
                render(React.createElement(FolderSection, { section: mockSection, selection: mockSelection, selectionToggle: mockSelectionToggle, onTagSelected: mockOnTagSelected }));
                yield userEvent.click(yield screen.findByRole('button', { name: mockSection.title }));
                expect(getGrafanaSearcher().search).toHaveBeenCalled();
                yield userEvent.click(yield screen.findByRole('checkbox', { name: 'Select folder' }));
                expect(mockSelectionToggle).toHaveBeenCalledWith('folder', 'my-folder');
                expect(mockSelectionToggle).toHaveBeenCalledWith('dashboard', 'my-dashboard-1');
            }));
        });
        describe('when in a pseudo-folder (i.e. Starred/Recent)', () => {
            const mockRecentSection = {
                kind: 'folder',
                uid: '__recent',
                title: 'Recent',
                itemsUIDs: ['my-dashboard-1'],
            };
            it('shows the correct folder name next to the dashboard', () => __awaiter(void 0, void 0, void 0, function* () {
                render(React.createElement(FolderSection, { section: mockRecentSection, onTagSelected: mockOnTagSelected }));
                yield userEvent.click(yield screen.findByRole('button', { name: mockRecentSection.title }));
                expect(getGrafanaSearcher().search).toHaveBeenCalled();
                expect(yield screen.findByText('My dashboard 1')).toBeInTheDocument();
                expect(yield screen.findByText('My folder 1')).toBeInTheDocument();
            }));
        });
    });
});
//# sourceMappingURL=FolderSection.test.js.map
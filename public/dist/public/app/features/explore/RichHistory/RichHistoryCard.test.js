import { __awaiter } from "tslib";
import { fireEvent, render, screen, getByText, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MixedDatasource } from 'app/plugins/datasource/mixed/MixedDataSource';
import { ShowConfirmModalEvent } from 'app/types/events';
import { RichHistoryCard } from './RichHistoryCard';
const starRichHistoryMock = jest.fn();
const deleteRichHistoryMock = jest.fn();
const mockEventBus = {
    publish: jest.fn(),
};
class MockDatasourceApi {
    constructor(name, id, type, uid, others) {
        this.name = name;
        this.id = id;
        this.type = type;
        this.uid = uid;
        this.meta = {
            info: {
                logos: {
                    small: `${type}.png`,
                },
            },
        };
        Object.assign(this, others);
    }
    query() {
        throw new Error('Method not implemented.');
    }
    testDatasource() {
        throw new Error('Method not implemented.');
    }
    getRef() {
        throw new Error('Method not implemented.');
    }
}
const dsStore = {
    alertmanager: new MockDatasourceApi('Alertmanager', 3, 'alertmanager', 'alertmanager'),
    loki: new MockDatasourceApi('Loki', 2, 'loki', 'loki'),
    prometheus: new MockDatasourceApi('Prometheus', 1, 'prometheus', 'prometheus', {
        getQueryDisplayText: (query) => query.queryText || 'Unknwon query',
    }),
    mixed: new MixedDatasource({
        id: 4,
        name: 'Mixed',
        type: 'mixed',
        uid: 'mixed',
        meta: { info: { logos: { small: 'mixed.png' } }, mixed: true },
    }),
};
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { reportInteraction: jest.fn(), getAppEvents: () => mockEventBus })));
jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => {
    return {
        getDataSourceSrv: () => ({
            get: (ref) => {
                const uid = typeof ref === 'string' ? ref : ref.uid;
                if (!uid) {
                    return Promise.reject();
                }
                if (dsStore[uid]) {
                    return Promise.resolve(dsStore[uid]);
                }
                return Promise.reject();
            },
        }),
    };
});
const copyStringToClipboard = jest.fn();
jest.mock('app/core/utils/explore', () => (Object.assign(Object.assign({}, jest.requireActual('app/core/utils/explore')), { copyStringToClipboard: (str) => copyStringToClipboard(str) })));
jest.mock('app/core/app_events', () => ({
    publish: jest.fn(),
}));
const setup = (propOverrides) => {
    const props = {
        query: {
            id: '1',
            createdAt: 1,
            datasourceUid: 'loki',
            datasourceName: 'Loki',
            starred: false,
            comment: '',
            queries: [
                { query: 'query1', refId: 'A' },
                { query: 'query2', refId: 'B' },
                { query: 'query3', refId: 'C' },
            ],
        },
        changeDatasource: jest.fn(),
        starHistoryItem: starRichHistoryMock,
        deleteHistoryItem: deleteRichHistoryMock,
        commentHistoryItem: jest.fn(),
        setQueries: jest.fn(),
        exploreId: 'left',
        datasourceInstance: dsStore.loki,
    };
    Object.assign(props, propOverrides);
    render(React.createElement(RichHistoryCard, Object.assign({}, props)));
};
const starredQueryWithComment = {
    id: '1',
    createdAt: 1,
    datasourceUid: 'Test datasource uid',
    datasourceName: 'Test datasource',
    starred: true,
    comment: 'test comment',
    queries: [
        { query: 'query1', refId: 'A' },
        { query: 'query2', refId: 'B' },
        { query: 'query3', refId: 'C' },
    ],
};
afterEach(() => {
    jest.clearAllMocks();
});
describe('RichHistoryCard', () => {
    it('should render all queries', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        const queries = yield screen.findAllByLabelText('Query text');
        expect(queries).toHaveLength(3);
        expect(queries[0]).toHaveTextContent('query1');
        expect(queries[1]).toHaveTextContent('query2');
        expect(queries[2]).toHaveTextContent('query3');
    }));
    it('should render data source icon and name', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        const datasourceIcon = yield screen.findByLabelText('Data source icon');
        const datasourceName = screen.getByLabelText('Data source name');
        expect(datasourceIcon).toBeInTheDocument();
        expect(datasourceName).toBeInTheDocument();
    }));
    it('should render "Data source does not exist anymore" if removed data source', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({
            query: {
                id: '2',
                createdAt: 1,
                datasourceUid: 'non-existent DS',
                datasourceName: 'Test datasource',
                starred: false,
                comment: '',
                queries: [
                    { query: 'query1', refId: 'A' },
                    { query: 'query2', refId: 'B' },
                    { query: 'query3', refId: 'C' },
                ],
            },
        });
        const datasourceName = yield screen.findByLabelText('Data source name');
        expect(datasourceName).toHaveTextContent('Data source does not exist anymore');
    }));
    describe('copy queries to clipboard', () => {
        it('should copy query model to clipboard when copying a query from a non existent datasource', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({
                query: {
                    id: '2',
                    createdAt: 1,
                    datasourceUid: 'non-existent DS',
                    datasourceName: 'Test datasource',
                    starred: false,
                    comment: '',
                    queries: [{ query: 'query1', refId: 'A' }],
                },
            });
            const copyQueriesButton = yield screen.findByRole('button', { name: 'Copy query to clipboard' });
            expect(copyQueriesButton).toBeInTheDocument();
            yield userEvent.click(copyQueriesButton);
            expect(copyStringToClipboard).toHaveBeenCalledTimes(1);
            expect(copyStringToClipboard).toHaveBeenCalledWith(JSON.stringify({ query: 'query1' }));
        }));
        it('should copy query model to clipboard when copying a query from a datasource that does not implement getQueryDisplayText', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({
                query: {
                    id: '2',
                    createdAt: 1,
                    datasourceUid: 'loki',
                    datasourceName: 'Test datasource',
                    starred: false,
                    comment: '',
                    queries: [{ query: 'query1', refId: 'A' }],
                },
            });
            const copyQueriesButton = yield screen.findByRole('button', { name: 'Copy query to clipboard' });
            expect(copyQueriesButton).toBeInTheDocument();
            yield userEvent.click(copyQueriesButton);
            expect(copyStringToClipboard).toHaveBeenCalledTimes(1);
            expect(copyStringToClipboard).toHaveBeenCalledWith(JSON.stringify({ query: 'query1' }));
        }));
        it('should copy query text to clipboard when copying a query from a datasource that implements getQueryDisplayText', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({
                query: {
                    id: '2',
                    createdAt: 1,
                    datasourceUid: 'prometheus',
                    datasourceName: 'Test datasource',
                    starred: false,
                    comment: '',
                    queries: [{ query: 'query1', refId: 'A', queryText: 'query1' }],
                },
            });
            const copyQueriesButton = yield screen.findByRole('button', { name: 'Copy query to clipboard' });
            expect(copyQueriesButton).toBeInTheDocument();
            yield userEvent.click(copyQueriesButton);
            expect(copyStringToClipboard).toHaveBeenCalledTimes(1);
            expect(copyStringToClipboard).toHaveBeenCalledWith('query1');
        }));
        it('should use each datasource getQueryDisplayText when copying queries', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({
                query: {
                    id: '2',
                    createdAt: 1,
                    datasourceUid: 'mixed',
                    datasourceName: 'Mixed',
                    starred: false,
                    comment: '',
                    queries: [
                        { query: 'query1', refId: 'A', queryText: 'query1', datasource: { uid: 'prometheus' } },
                        { query: 'query2', refId: 'B', datasource: { uid: 'loki' } },
                    ],
                },
            });
            const copyQueriesButton = yield screen.findByRole('button', { name: 'Copy query to clipboard' });
            expect(copyQueriesButton).toBeInTheDocument();
            yield userEvent.click(copyQueriesButton);
            expect(copyStringToClipboard).toHaveBeenCalledTimes(1);
            expect(copyStringToClipboard).toHaveBeenCalledWith(`query1\n${JSON.stringify({ query: 'query2' })}`);
        }));
    });
    describe('run queries', () => {
        it('should be disabled if at least one query datasource is missing when using mixed', () => __awaiter(void 0, void 0, void 0, function* () {
            const setQueries = jest.fn();
            const changeDatasource = jest.fn();
            const queries = [
                { query: 'query1', refId: 'A', datasource: { uid: 'nonexistent-ds' } },
                { query: 'query2', refId: 'B', datasource: { uid: 'loki' } },
            ];
            setup({
                setQueries,
                changeDatasource,
                query: {
                    id: '2',
                    createdAt: 1,
                    datasourceUid: 'mixed',
                    datasourceName: 'Mixed',
                    starred: false,
                    comment: '',
                    queries,
                },
            });
            const runQueryButton = yield screen.findByRole('button', { name: /run query/i });
            expect(runQueryButton).toBeDisabled();
        }));
        it('should be disabled if at datasource is missing', () => __awaiter(void 0, void 0, void 0, function* () {
            const setQueries = jest.fn();
            const changeDatasource = jest.fn();
            const queries = [
                { query: 'query1', refId: 'A' },
                { query: 'query2', refId: 'B' },
            ];
            setup({
                setQueries,
                changeDatasource,
                query: {
                    id: '2',
                    createdAt: 1,
                    datasourceUid: 'nonexistent-ds',
                    datasourceName: 'nonexistent-ds',
                    starred: false,
                    comment: '',
                    queries,
                },
            });
            const runQueryButton = yield screen.findByRole('button', { name: /run query/i });
            expect(runQueryButton).toBeDisabled();
        }));
        it('should only set new queries when running queries from the same datasource', () => __awaiter(void 0, void 0, void 0, function* () {
            const setQueries = jest.fn();
            const changeDatasource = jest.fn();
            const queries = [
                { query: 'query1', refId: 'A' },
                { query: 'query2', refId: 'B' },
            ];
            setup({
                setQueries,
                changeDatasource,
                query: {
                    id: '2',
                    createdAt: 1,
                    datasourceUid: 'loki',
                    datasourceName: 'Loki',
                    starred: false,
                    comment: '',
                    queries,
                },
            });
            const runQueryButton = yield screen.findByRole('button', { name: /run query/i });
            yield userEvent.click(runQueryButton);
            expect(setQueries).toHaveBeenCalledWith(expect.any(String), queries);
            expect(changeDatasource).not.toHaveBeenCalled();
        }));
        it('should change datasource to mixed and set new queries when running queries from mixed datasource', () => __awaiter(void 0, void 0, void 0, function* () {
            const setQueries = jest.fn();
            const changeDatasource = jest.fn();
            const queries = [
                { query: 'query1', refId: 'A', datasource: { type: 'loki', uid: 'loki' } },
                { query: 'query2', refId: 'B', datasource: { type: 'prometheus', uid: 'prometheus' } },
            ];
            setup({
                setQueries,
                changeDatasource,
                query: {
                    id: '2',
                    createdAt: 1,
                    datasourceUid: 'mixed',
                    datasourceName: 'Mixed',
                    starred: false,
                    comment: '',
                    queries,
                },
            });
            const runQueryButton = yield screen.findByRole('button', { name: /run query/i });
            yield userEvent.click(runQueryButton);
            yield waitFor(() => {
                expect(setQueries).toHaveBeenCalledWith(expect.any(String), queries);
                expect(changeDatasource).toHaveBeenCalledWith(expect.any(String), 'mixed');
            });
        }));
    });
    describe('commenting', () => {
        it('should render comment, if comment present', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({ query: starredQueryWithComment });
            const queryComment = yield screen.findByLabelText('Query comment');
            expect(queryComment).toBeInTheDocument();
            expect(queryComment).toHaveTextContent('test comment');
        }));
        it('should have title "Edit comment" at comment icon, if comment present', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({ query: starredQueryWithComment });
            const editComment = yield screen.findByLabelText('Edit comment');
            const addComment = screen.queryByTitle('Add comment');
            expect(editComment).toBeInTheDocument();
            expect(addComment).not.toBeInTheDocument();
        }));
        it('should have title "Add comment" at comment icon, if no comment present', () => __awaiter(void 0, void 0, void 0, function* () {
            setup();
            const addComment = yield screen.findByLabelText('Add comment');
            const editComment = yield screen.queryByTitle('Edit comment');
            expect(addComment).toBeInTheDocument();
            expect(editComment).not.toBeInTheDocument();
        }));
        it('should open update comment form when edit comment button clicked', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({ query: starredQueryWithComment });
            const editComment = yield screen.findByLabelText('Edit comment');
            yield userEvent.click(editComment);
            const updateCommentForm = yield screen.findByLabelText('Update comment form');
            expect(updateCommentForm).toBeInTheDocument();
        }));
        it('should close update comment form when escape key pressed', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({ query: starredQueryWithComment });
            const editComment = yield screen.findByLabelText('Edit comment');
            yield userEvent.click(editComment);
            const updateCommentForm = yield screen.findByLabelText('Update comment form');
            yield userEvent.click(updateCommentForm);
            fireEvent.keyDown(getByText(updateCommentForm, starredQueryWithComment.comment), {
                key: 'Escape',
            });
            const findCommentForm = screen.queryByLabelText('Update comment form');
            expect(findCommentForm).not.toBeInTheDocument();
        }));
        it('should close update comment form when enter and shift keys pressed', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({ query: starredQueryWithComment });
            const editComment = yield screen.findByLabelText('Edit comment');
            yield userEvent.click(editComment);
            const updateCommentForm = yield screen.findByLabelText('Update comment form');
            yield userEvent.click(updateCommentForm);
            fireEvent.keyDown(getByText(updateCommentForm, starredQueryWithComment.comment), {
                key: 'Enter',
                shiftKey: true,
            });
            const findCommentForm = screen.queryByLabelText('Update comment form');
            expect(findCommentForm).not.toBeInTheDocument();
        }));
        it('should close update comment form when enter and ctrl keys pressed', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({ query: starredQueryWithComment });
            const editComment = yield screen.findByLabelText('Edit comment');
            yield userEvent.click(editComment);
            const updateCommentForm = yield screen.findByLabelText('Update comment form');
            yield userEvent.click(updateCommentForm);
            fireEvent.keyDown(getByText(updateCommentForm, starredQueryWithComment.comment), {
                key: 'Enter',
                ctrlKey: true,
            });
            const findCommentForm = screen.queryByLabelText('Update comment form');
            expect(findCommentForm).not.toBeInTheDocument();
        }));
        it('should not close update comment form when enter key pressed', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({ query: starredQueryWithComment });
            const editComment = yield screen.findByLabelText('Edit comment');
            yield userEvent.click(editComment);
            const updateCommentForm = yield screen.findByLabelText('Update comment form');
            yield userEvent.click(updateCommentForm);
            fireEvent.keyDown(getByText(updateCommentForm, starredQueryWithComment.comment), {
                key: 'Enter',
                shiftKey: false,
            });
            const findCommentForm = screen.queryByLabelText('Update comment form');
            expect(findCommentForm).toBeInTheDocument();
        }));
    });
    describe('starring', () => {
        it('should have title "Star query", if not starred', () => __awaiter(void 0, void 0, void 0, function* () {
            setup();
            const starButton = yield screen.findByLabelText('Star query');
            expect(starButton).toBeInTheDocument();
            yield userEvent.click(starButton);
            expect(starRichHistoryMock).toBeCalledWith(starredQueryWithComment.id, true);
        }));
        it('should have title "Unstar query", if not starred', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({ query: starredQueryWithComment });
            const unstarButton = yield screen.findByLabelText('Unstar query');
            expect(unstarButton).toBeInTheDocument();
            yield userEvent.click(unstarButton);
            expect(starRichHistoryMock).toBeCalledWith(starredQueryWithComment.id, false);
        }));
    });
    describe('deleting', () => {
        it('should delete if not starred', () => __awaiter(void 0, void 0, void 0, function* () {
            setup();
            const deleteButton = yield screen.findByLabelText('Delete query');
            expect(deleteButton).toBeInTheDocument();
            yield userEvent.click(deleteButton);
            expect(deleteRichHistoryMock).toBeCalledWith(starredQueryWithComment.id);
        }));
        it('should display modal before deleting if starred', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({ query: starredQueryWithComment });
            const deleteButton = yield screen.findByLabelText('Delete query');
            yield userEvent.click(deleteButton);
            expect(deleteRichHistoryMock).not.toBeCalled();
            expect(mockEventBus.publish).toHaveBeenCalledWith(new ShowConfirmModalEvent(expect.anything()));
        }));
    });
});
//# sourceMappingURL=RichHistoryCard.test.js.map
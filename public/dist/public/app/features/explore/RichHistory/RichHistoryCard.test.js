import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { RichHistoryCard } from './RichHistoryCard';
import { ExploreId } from '../../../types/explore';
var setup = function (propOverrides) {
    var props = {
        query: {
            ts: 1,
            datasourceName: 'Test datasource',
            datasourceId: 'datasource 1',
            starred: false,
            comment: '',
            queries: [
                { expr: 'query1', refId: 'A' },
                { expr: 'query2', refId: 'B' },
                { expr: 'query3', refId: 'C' },
            ],
            sessionName: '',
        },
        dsImg: '/app/img',
        isRemoved: false,
        changeDatasource: jest.fn(),
        updateRichHistory: jest.fn(),
        setQueries: jest.fn(),
        exploreId: ExploreId.left,
        datasourceInstance: { name: 'Datasource' },
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(RichHistoryCard, __assign({}, props)));
    return wrapper;
};
var starredQueryWithComment = {
    ts: 1,
    datasourceName: 'Test datasource',
    datasourceId: 'datasource 1',
    starred: true,
    comment: 'test comment',
    queries: [
        { query: 'query1', refId: 'A' },
        { query: 'query2', refId: 'B' },
        { query: 'query3', refId: 'C' },
    ],
    sessionName: '',
};
describe('RichHistoryCard', function () {
    it('should render all queries', function () {
        var wrapper = setup();
        expect(wrapper.find({ 'aria-label': 'Query text' })).toHaveLength(3);
        expect(wrapper.find({ 'aria-label': 'Query text' }).at(0).text()).toEqual('{"expr":"query1"}');
        expect(wrapper.find({ 'aria-label': 'Query text' }).at(1).text()).toEqual('{"expr":"query2"}');
        expect(wrapper.find({ 'aria-label': 'Query text' }).at(2).text()).toEqual('{"expr":"query3"}');
    });
    it('should render data source icon', function () {
        var wrapper = setup();
        expect(wrapper.find({ 'aria-label': 'Data source icon' })).toHaveLength(1);
    });
    it('should render data source name', function () {
        var wrapper = setup();
        expect(wrapper.find({ 'aria-label': 'Data source name' }).text()).toEqual('Test datasource');
    });
    it('should render "Data source does not exist anymore" if removed data source', function () {
        var wrapper = setup({ isRemoved: true });
        expect(wrapper.find({ 'aria-label': 'Data source name' }).text()).toEqual('Data source does not exist anymore');
    });
    describe('commenting', function () {
        it('should render comment, if comment present', function () {
            var wrapper = setup({ query: starredQueryWithComment });
            expect(wrapper.find({ 'aria-label': 'Query comment' })).toHaveLength(1);
            expect(wrapper.find({ 'aria-label': 'Query comment' }).text()).toEqual('test comment');
        });
        it('should have title "Edit comment" at comment icon, if comment present', function () {
            var wrapper = setup({ query: starredQueryWithComment });
            expect(wrapper.find({ title: 'Edit comment' })).toHaveLength(1);
            expect(wrapper.find({ title: 'Add comment' })).toHaveLength(0);
        });
        it('should have title "Add comment" at comment icon, if no comment present', function () {
            var wrapper = setup();
            expect(wrapper.find({ title: 'Add comment' })).toHaveLength(1);
            expect(wrapper.find({ title: 'Edit comment' })).toHaveLength(0);
        });
        it('should open update comment form when edit comment button clicked', function () {
            var wrapper = setup({ query: starredQueryWithComment });
            var editCommentButton = wrapper.find({ title: 'Edit comment' });
            editCommentButton.simulate('click');
            expect(wrapper.find({ 'aria-label': 'Update comment form' })).toHaveLength(1);
        });
        it('should close update comment form when escape key pressed', function () {
            var wrapper = setup({ query: starredQueryWithComment });
            var editCommentButton = wrapper.find({ title: 'Edit comment' });
            editCommentButton.simulate('click');
            wrapper.simulate('keydown', { key: 'Escape' });
            expect(wrapper.find({ 'aria-label': 'Update comment form' })).toHaveLength(0);
        });
        it('should close update comment form when enter and shift keys pressed', function () {
            var wrapper = setup({ query: starredQueryWithComment });
            var editCommentButton = wrapper.find({ title: 'Edit comment' });
            editCommentButton.simulate('click');
            wrapper.simulate('keydown', { key: 'Enter', shiftKey: true });
            expect(wrapper.find({ 'aria-label': 'Update comment form' })).toHaveLength(0);
        });
        it('should close update comment form when enter and ctrl keys pressed', function () {
            var wrapper = setup({ query: starredQueryWithComment });
            var editCommentButton = wrapper.find({ title: 'Edit comment' });
            editCommentButton.simulate('click');
            wrapper.simulate('keydown', { key: 'Enter', ctrlKey: true });
            expect(wrapper.find({ 'aria-label': 'Update comment form' })).toHaveLength(0);
        });
        it('should not close update comment form when enter key pressed', function () {
            var wrapper = setup({ query: starredQueryWithComment });
            var editCommentButton = wrapper.find({ title: 'Edit comment' });
            editCommentButton.simulate('click');
            wrapper.simulate('keydown', { key: 'Enter', shiftKey: false });
            expect(wrapper.find({ 'aria-label': 'Update comment form' })).toHaveLength(1);
        });
    });
    describe('starring', function () {
        it('should have title "Star query", if not starred', function () {
            var wrapper = setup();
            expect(wrapper.find({ title: 'Star query' })).toHaveLength(1);
        });
        it('should have title "Unstar query", if not starred', function () {
            var wrapper = setup({ query: starredQueryWithComment });
            expect(wrapper.find({ title: 'Unstar query' })).toHaveLength(1);
        });
    });
});
//# sourceMappingURL=RichHistoryCard.test.js.map
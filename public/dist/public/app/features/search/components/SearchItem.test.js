import { __assign } from "tslib";
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchItem } from './SearchItem';
import { DashboardSearchItemType } from '../types';
beforeEach(function () {
    jest.clearAllMocks();
});
var data = {
    id: 1,
    uid: 'lBdLINUWk',
    title: 'Test 1',
    uri: 'db/test1',
    url: '/d/lBdLINUWk/test1',
    slug: '',
    type: DashboardSearchItemType.DashDB,
    tags: ['Tag1', 'Tag2'],
    isStarred: false,
    checked: false,
};
var setup = function (propOverrides) {
    var props = {
        item: data,
        onTagSelected: jest.fn(),
        editable: false,
    };
    Object.assign(props, propOverrides);
    render(React.createElement(SearchItem, __assign({}, props)));
};
describe('SearchItem', function () {
    it('should render the item', function () {
        setup();
        expect(screen.getAllByLabelText('Dashboard search item Test 1')).toHaveLength(1);
        expect(screen.getAllByText('Test 1')).toHaveLength(1);
    });
    it('should toggle items when checked', function () {
        var mockedOnToggleChecked = jest.fn();
        setup({ editable: true, onToggleChecked: mockedOnToggleChecked });
        var checkbox = screen.getByRole('checkbox');
        expect(checkbox).not.toBeChecked();
        fireEvent.click(checkbox);
        expect(mockedOnToggleChecked).toHaveBeenCalledTimes(1);
        expect(mockedOnToggleChecked).toHaveBeenCalledWith(data);
    });
    it('should mark items as checked', function () {
        setup({ editable: true, item: __assign(__assign({}, data), { checked: true }) });
        expect(screen.getByRole('checkbox')).toBeChecked();
    });
    it("should render item's tags", function () {
        setup();
        expect(screen.getAllByText(/tag/i)).toHaveLength(2);
    });
    it('should select the tag on tag click', function () {
        var mockOnTagSelected = jest.fn();
        setup({ onTagSelected: mockOnTagSelected });
        fireEvent.click(screen.getByText('Tag1'));
        expect(mockOnTagSelected).toHaveBeenCalledTimes(1);
        expect(mockOnTagSelected).toHaveBeenCalledWith('Tag1');
    });
});
//# sourceMappingURL=SearchItem.test.js.map
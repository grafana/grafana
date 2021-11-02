import { __assign } from "tslib";
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchResults } from './SearchResults';
import { searchResults, generalFolder } from '../testData';
import { SearchLayout } from '../types';
beforeEach(function () {
    jest.clearAllMocks();
});
var setup = function (propOverrides) {
    var props = {
        results: searchResults,
        onTagSelected: function (name) { },
        onToggleSection: function () { },
        editable: false,
        layout: SearchLayout.Folders,
    };
    Object.assign(props, propOverrides);
    render(React.createElement(SearchResults, __assign({}, props)));
};
describe('SearchResults', function () {
    it('should render result items', function () {
        setup();
        expect(screen.getAllByLabelText('Search section')).toHaveLength(2);
    });
    it('should render section items for expanded section', function () {
        setup();
        expect(screen.getAllByLabelText(/collapse folder/i)).toHaveLength(1);
        expect(screen.getAllByLabelText('Search items')).toHaveLength(1);
        expect(screen.getAllByLabelText(/dashboard search item/i)).toHaveLength(2);
    });
    it('should not render checkboxes for non-editable results', function () {
        setup({ editable: false });
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    });
    it('should render checkboxes for editable results', function () {
        setup({ editable: true });
        expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    });
    it('should collapse folder item list on header click', function () {
        var mockOnToggleSection = jest.fn();
        setup({ onToggleSection: mockOnToggleSection });
        fireEvent.click(screen.getByLabelText('Collapse folder 0'));
        expect(mockOnToggleSection).toHaveBeenCalledTimes(1);
        expect(mockOnToggleSection).toHaveBeenCalledWith(generalFolder);
    });
    it('should not throw an error if the search results have an empty title', function () {
        var mockOnToggleSection = jest.fn();
        var searchResultsEmptyTitle = searchResults.slice();
        searchResultsEmptyTitle[0].title = '';
        expect(function () {
            setup({ results: searchResultsEmptyTitle, onToggleSection: mockOnToggleSection });
        }).not.toThrowError();
    });
});
//# sourceMappingURL=SearchResults.test.js.map
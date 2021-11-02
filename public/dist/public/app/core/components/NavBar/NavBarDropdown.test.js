import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import NavBarDropdown from './NavBarDropdown';
describe('NavBarDropdown', function () {
    var mockHeaderText = 'MyHeaderText';
    var mockHeaderUrl = '/route';
    var mockOnHeaderClick = jest.fn();
    var mockItems = [
        {
            text: 'First link',
        },
        {
            text: 'Second link',
        },
    ];
    it('displays the header text', function () {
        render(React.createElement(NavBarDropdown, { headerText: mockHeaderText }));
        var text = screen.getByText(mockHeaderText);
        expect(text).toBeInTheDocument();
    });
    it('attaches the header url to the header text if provided', function () {
        render(React.createElement(BrowserRouter, null,
            React.createElement(NavBarDropdown, { headerText: mockHeaderText, headerUrl: mockHeaderUrl })));
        var link = screen.getByRole('link', { name: mockHeaderText });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', mockHeaderUrl);
    });
    it('calls the onHeaderClick function when the header is clicked', function () {
        render(React.createElement(NavBarDropdown, { headerText: mockHeaderText, onHeaderClick: mockOnHeaderClick }));
        var text = screen.getByText(mockHeaderText);
        expect(text).toBeInTheDocument();
        userEvent.click(text);
        expect(mockOnHeaderClick).toHaveBeenCalled();
    });
    it('displays the items', function () {
        render(React.createElement(NavBarDropdown, { headerText: mockHeaderText, items: mockItems }));
        mockItems.forEach(function (_a) {
            var text = _a.text;
            var childItem = screen.getByText(text);
            expect(childItem).toBeInTheDocument();
        });
    });
});
//# sourceMappingURL=NavBarDropdown.test.js.map
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import NavBarItem from './NavBarItem';
describe('NavBarItem', function () {
    it('renders the children', function () {
        var mockLabel = 'Hello';
        render(React.createElement(BrowserRouter, null,
            React.createElement(NavBarItem, { label: mockLabel },
                React.createElement("div", { "data-testid": "mockChild" }))));
        var child = screen.getByTestId('mockChild');
        expect(child).toBeInTheDocument();
    });
    it('wraps the children in a link to the url if provided', function () {
        var mockLabel = 'Hello';
        var mockUrl = '/route';
        render(React.createElement(BrowserRouter, null,
            React.createElement(NavBarItem, { label: mockLabel, url: mockUrl },
                React.createElement("div", { "data-testid": "mockChild" }))));
        var child = screen.getByTestId('mockChild');
        expect(child).toBeInTheDocument();
        userEvent.click(child);
        expect(window.location.pathname).toEqual(mockUrl);
    });
    it('wraps the children in an onClick if provided', function () {
        var mockLabel = 'Hello';
        var mockOnClick = jest.fn();
        render(React.createElement(BrowserRouter, null,
            React.createElement(NavBarItem, { label: mockLabel, onClick: mockOnClick },
                React.createElement("div", { "data-testid": "mockChild" }))));
        var child = screen.getByTestId('mockChild');
        expect(child).toBeInTheDocument();
        userEvent.click(child);
        expect(mockOnClick).toHaveBeenCalled();
    });
});
//# sourceMappingURL=NavBarItem.test.js.map
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DropdownChild from './DropdownChild';
describe('DropdownChild', function () {
    var mockText = 'MyChildItem';
    var mockUrl = '/route';
    var mockIcon = 'home-alt';
    it('displays the text', function () {
        render(React.createElement(DropdownChild, { text: mockText }));
        var text = screen.getByText(mockText);
        expect(text).toBeInTheDocument();
    });
    it('attaches the url to the text if provided', function () {
        render(React.createElement(BrowserRouter, null,
            React.createElement(DropdownChild, { text: mockText, url: mockUrl })));
        var link = screen.getByRole('link', { name: mockText });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', mockUrl);
    });
    it('displays an icon if a valid icon is provided', function () {
        render(React.createElement(DropdownChild, { text: mockText, icon: mockIcon }));
        var icon = screen.getByTestId('dropdown-child-icon');
        expect(icon).toBeInTheDocument();
    });
    it('displays an external link icon if the target is _blank', function () {
        render(React.createElement(DropdownChild, { text: mockText, icon: mockIcon, url: mockUrl, target: "_blank" }));
        var icon = screen.getByTestId('external-link-icon');
        expect(icon).toBeInTheDocument();
    });
    it('displays a divider instead when isDivider is true', function () {
        render(React.createElement(DropdownChild, { text: mockText, icon: mockIcon, url: mockUrl, isDivider: true }));
        // Check the divider is shown
        var divider = screen.getByTestId('dropdown-child-divider');
        expect(divider).toBeInTheDocument();
        // Check nothing else is rendered
        var text = screen.queryByText(mockText);
        var icon = screen.queryByTestId('dropdown-child-icon');
        var link = screen.queryByRole('link', { name: mockText });
        expect(text).not.toBeInTheDocument();
        expect(icon).not.toBeInTheDocument();
        expect(link).not.toBeInTheDocument();
    });
});
//# sourceMappingURL=DropdownChild.test.js.map
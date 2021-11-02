import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TopSection from './TopSection';
jest.mock('../../config', function () { return ({
    bootData: {
        navTree: [
            { id: '1', hideFromMenu: true },
            { id: '2', hideFromMenu: true },
            { id: '3', hideFromMenu: false },
            { id: '4', hideFromMenu: true },
            { id: '4', hideFromMenu: false },
        ],
    },
}); });
describe('Render', function () {
    it('should render search when empty', function () {
        render(React.createElement(BrowserRouter, null,
            React.createElement(TopSection, null)));
        expect(screen.getByText('Search dashboards')).toBeInTheDocument();
    });
    it('should render items and search item', function () {
        render(React.createElement(BrowserRouter, null,
            React.createElement(TopSection, null)));
        expect(screen.getByTestId('top-section-items').children.length).toBe(3);
    });
});
//# sourceMappingURL=TopSection.test.js.map
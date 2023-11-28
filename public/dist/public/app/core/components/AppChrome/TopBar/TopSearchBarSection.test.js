import { render, screen } from '@testing-library/react';
import React from 'react';
import { TopSearchBarSection } from './TopSearchBarSection';
const renderComponent = (options) => {
    const { props } = options || {};
    return render(React.createElement(TopSearchBarSection, Object.assign({}, props),
        React.createElement("button", null, "Test Item")));
};
describe('TopSearchBarSection', () => {
    it('should use a wrapper on non mobile screen', () => {
        window.matchMedia.mockImplementation(() => ({
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            matches: true,
        }));
        const component = renderComponent();
        expect(component.queryByTestId('wrapper')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /test item/i })).toBeInTheDocument();
    });
    it('should not use a wrapper on mobile screen', () => {
        window.matchMedia.mockImplementation(() => ({
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            matches: false,
        }));
        const component = renderComponent();
        expect(component.queryByTestId('wrapper')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /test item/i })).toBeInTheDocument();
    });
});
//# sourceMappingURL=TopSearchBarSection.test.js.map
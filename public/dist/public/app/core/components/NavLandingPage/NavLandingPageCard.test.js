import { render, screen } from '@testing-library/react';
import React from 'react';
import { NavLandingPageCard } from './NavLandingPageCard';
describe('NavLandingPageCard', () => {
    const mockText = 'My heading';
    const mockUrl = 'http://www.example.com/';
    it('uses the text as a heading', () => {
        render(React.createElement(NavLandingPageCard, { text: mockText, url: mockUrl }));
        expect(screen.getByRole('heading', { name: mockText })).toBeInTheDocument();
    });
    it('labels the link correctly', () => {
        render(React.createElement(NavLandingPageCard, { text: mockText, url: mockUrl }));
        const link = screen.getByRole('link', { name: mockText });
        expect(link).toBeInTheDocument();
        expect(link).toHaveProperty('href', mockUrl);
    });
    it('renders the description', () => {
        const mockDescription = 'My description';
        render(React.createElement(NavLandingPageCard, { text: mockText, url: mockUrl, description: mockDescription }));
        expect(screen.getByText(mockDescription)).toBeInTheDocument();
    });
});
//# sourceMappingURL=NavLandingPageCard.test.js.map
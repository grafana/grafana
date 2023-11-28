import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { Breadcrumbs } from './Breadcrumbs';
const mockBreadcrumbs = [
    { text: 'Home', href: '/home' },
    { text: 'First', href: '/first' },
    { text: 'Second', href: '/second' },
];
describe('Breadcrumbs', () => {
    it('should render without error', () => {
        expect(() => render(React.createElement(Breadcrumbs, { breadcrumbs: [] }))).not.toThrow();
    });
    it('should render a <nav> element', () => {
        render(React.createElement(Breadcrumbs, { breadcrumbs: [] }));
        expect(screen.getByRole('navigation')).toBeInTheDocument();
    });
    it('should render links for each breadcrumb except the last', () => {
        render(React.createElement(Breadcrumbs, { breadcrumbs: mockBreadcrumbs }));
        const nav = screen.getByRole('navigation');
        const links = within(nav).getAllByRole('link');
        expect(links.length).toEqual(2);
        const homeLink = within(nav).getByRole('link', { name: 'Home' });
        expect(homeLink).toBeInTheDocument();
        expect(homeLink).toHaveAttribute('href', '/home');
        const firstLink = within(nav).getByRole('link', { name: 'First' });
        expect(firstLink).toBeInTheDocument();
        expect(firstLink).toHaveAttribute('href', '/first');
    });
    it('should render the last breadcrumb as text and set the correct aria-current attribute', () => {
        render(React.createElement(Breadcrumbs, { breadcrumbs: mockBreadcrumbs }));
        const nav = screen.getByRole('navigation');
        expect(within(nav).queryByRole('link', { name: 'Second' })).not.toBeInTheDocument();
        expect(within(nav).getByText('Second')).toBeInTheDocument();
        expect(within(nav).getByText('Second')).toHaveAttribute('aria-current', 'page');
    });
});
//# sourceMappingURL=Breadcrumbs.test.js.map
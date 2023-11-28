import { render, screen } from '@testing-library/react';
import React from 'react';
import PageActionBar from './PageActionBar';
const setup = (propOverrides) => {
    const props = {
        searchQuery: '',
        setSearchQuery: jest.fn(),
        target: '_blank',
        linkButton: { href: 'some/url', title: 'test' },
    };
    Object.assign(props, propOverrides);
    return render(React.createElement(PageActionBar, Object.assign({}, props)));
};
describe('Render', () => {
    it('should render component', () => {
        setup();
        expect(screen.getByRole('textbox')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'test' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    });
    it('should render button when text is present', () => {
        setup({ searchQuery: 'test query' });
        expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    });
});
//# sourceMappingURL=PageActionBar.test.js.map
import { render as rtlRender, screen } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { BrowseActions } from './BrowseActions';
function render(...[ui, options]) {
    rtlRender(React.createElement(TestProvider, null, ui), options);
}
describe('browse-dashboards BrowseActions', () => {
    it('displays Move and Delete buttons', () => {
        render(React.createElement(BrowseActions, null));
        expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });
});
//# sourceMappingURL=BrowseActions.test.js.map
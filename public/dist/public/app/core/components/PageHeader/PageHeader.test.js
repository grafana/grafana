import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { PageHeader } from './PageHeader';
describe('PageHeader', () => {
    describe('when the nav tree has a node with a title', () => {
        it('should render the title', () => __awaiter(void 0, void 0, void 0, function* () {
            const nav = {
                icon: 'folder-open',
                id: 'node',
                subTitle: 'node subtitle',
                url: '',
                text: 'node',
            };
            render(React.createElement(PageHeader, { navItem: nav }));
            expect(screen.getByRole('heading', { name: 'node' })).toBeInTheDocument();
        }));
    });
});
//# sourceMappingURL=PageHeader.test.js.map
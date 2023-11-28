import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { reportInteraction } from '@grafana/runtime';
import { QuickAdd } from './QuickAdd';
jest.mock('@grafana/runtime', () => {
    return Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { reportInteraction: jest.fn() });
});
const setup = () => {
    const navBarTree = [
        {
            text: 'Section 1',
            id: 'section1',
            url: 'section1',
            children: [
                { text: 'New child 1', id: 'child1', url: '#', isCreateAction: true },
                { text: 'Child2', id: 'child2', url: 'section1/child2' },
            ],
        },
        {
            text: 'Section 2',
            id: 'section2',
            url: 'section2',
            children: [{ text: 'New child 3', id: 'child3', url: 'section2/child3', isCreateAction: true }],
        },
    ];
    return render(React.createElement(TestProvider, { storeState: { navBarTree } },
        React.createElement(QuickAdd, null)));
};
describe('QuickAdd', () => {
    it('renders a `New` button', () => {
        setup();
        expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
    });
    it('shows isCreateAction options when clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        yield userEvent.click(screen.getByRole('button', { name: 'New' }));
        expect(screen.getByRole('link', { name: 'New child 1' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'New child 3' })).toBeInTheDocument();
    }));
    it('reports interaction when a menu item is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        yield userEvent.click(screen.getByRole('button', { name: 'New' }));
        yield userEvent.click(screen.getByRole('link', { name: 'New child 1' }));
        expect(reportInteraction).toHaveBeenCalledWith('grafana_menu_item_clicked', {
            url: '#',
            from: 'quickadd',
        });
    }));
});
//# sourceMappingURL=QuickAdd.test.js.map
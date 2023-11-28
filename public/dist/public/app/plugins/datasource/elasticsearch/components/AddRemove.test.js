import { render, screen } from '@testing-library/react';
import React from 'react';
import { AddRemove } from './AddRemove';
const noop = () => { };
const TestComponent = ({ items }) => (React.createElement(React.Fragment, null, items.map((_, index) => (React.createElement(AddRemove, { key: index, elements: items, index: index, onAdd: noop, onRemove: noop })))));
describe('AddRemove Button', () => {
    describe("When There's only one element in the list", () => {
        it('Should only show the add button', () => {
            render(React.createElement(TestComponent, { items: ['something'] }));
            expect(screen.getByLabelText('Add')).toBeInTheDocument();
            expect(screen.queryByLabelText('Remove')).not.toBeInTheDocument();
        });
    });
    describe("When There's more than one element in the list", () => {
        it('Should show the remove button on every element', () => {
            const items = ['something', 'something else'];
            render(React.createElement(TestComponent, { items: items }));
            expect(screen.getAllByLabelText('Remove')).toHaveLength(items.length);
        });
        it('Should show the add button only once', () => {
            const items = ['something', 'something else'];
            render(React.createElement(TestComponent, { items: items }));
            expect(screen.getAllByLabelText('Add')).toHaveLength(1);
        });
    });
});
//# sourceMappingURL=AddRemove.test.js.map
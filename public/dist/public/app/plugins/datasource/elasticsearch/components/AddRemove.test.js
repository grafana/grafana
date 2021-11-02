import React from 'react';
import { render, screen } from '@testing-library/react';
import { AddRemove } from './AddRemove';
var noop = function () { };
var TestComponent = function (_a) {
    var items = _a.items;
    return (React.createElement(React.Fragment, null, items.map(function (_, index) { return (React.createElement(AddRemove, { key: index, elements: items, index: index, onAdd: noop, onRemove: noop })); })));
};
describe('AddRemove Button', function () {
    describe("When There's only one element in the list", function () {
        it('Should only show the add button', function () {
            render(React.createElement(TestComponent, { items: ['something'] }));
            expect(screen.getByText('add')).toBeInTheDocument();
            expect(screen.queryByText('remove')).not.toBeInTheDocument();
        });
    });
    describe("When There's more than one element in the list", function () {
        it('Should show the remove button on every element', function () {
            var items = ['something', 'something else'];
            render(React.createElement(TestComponent, { items: items }));
            expect(screen.getAllByText('remove')).toHaveLength(items.length);
        });
        it('Should show the add button only once', function () {
            var items = ['something', 'something else'];
            render(React.createElement(TestComponent, { items: items }));
            expect(screen.getAllByText('add')).toHaveLength(1);
        });
    });
});
//# sourceMappingURL=AddRemove.test.js.map
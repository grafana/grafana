import React from 'react';
import { render, screen } from '@testing-library/react';
import { FunctionEditor } from './FunctionEditor';
import { FuncInstance } from '../gfunc';
function mockFunctionInstance(name, unknown) {
    var def = {
        category: 'category',
        defaultParams: [],
        fake: false,
        name: name,
        params: [],
        unknown: unknown,
    };
    return new FuncInstance(def);
}
describe('FunctionEditor', function () {
    it('should display a defined function with name and no icon', function () {
        render(React.createElement(FunctionEditor, { func: mockFunctionInstance('foo'), onMoveLeft: function () { }, onMoveRight: function () { }, onRemove: function () { } }));
        expect(screen.getByText('foo')).toBeInTheDocument();
        expect(screen.queryByTestId('warning-icon')).not.toBeInTheDocument();
    });
    it('should display an unknown function with name and warning icon', function () {
        render(React.createElement(FunctionEditor, { func: mockFunctionInstance('bar', true), onMoveLeft: jest.fn(), onMoveRight: jest.fn(), onRemove: jest.fn() }));
        expect(screen.getByText('bar')).toBeInTheDocument();
        expect(screen.getByTestId('warning-icon')).toBeInTheDocument();
    });
});
//# sourceMappingURL=FunctionEditor.test.js.map
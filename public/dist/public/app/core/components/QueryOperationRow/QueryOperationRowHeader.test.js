import { render, screen } from '@testing-library/react';
import React from 'react';
import { QueryOperationRowHeader } from './QueryOperationRowHeader';
const setup = (propOverrides) => {
    const props = Object.assign({ title: 'test-title', draggable: true, isContentVisible: true, id: 'test-id', onRowToggle: jest.fn(), reportDragMousePosition: jest.fn() }, propOverrides);
    return render(React.createElement(QueryOperationRowHeader, Object.assign({}, props)));
};
describe('QueryOperationRowHeader', () => {
    test('renders without exploding', () => {
        expect(() => setup()).not.toThrow();
    });
    describe('collapsable property', () => {
        test('should show the button to collapse the query row by default', () => {
            setup();
            expect(screen.getByLabelText('Collapse query row')).toBeInTheDocument();
        });
        test('should hide the button to collapse the query row when collapsable is set as false', () => {
            setup({ collapsable: false });
            expect(screen.queryByLabelText('Collapse query row')).not.toBeInTheDocument();
        });
    });
});
//# sourceMappingURL=QueryOperationRowHeader.test.js.map
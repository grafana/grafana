import { render, screen } from '@testing-library/react';
import { noop } from 'lodash';
import React from 'react';
import { CollapseToggle } from './CollapseToggle';
describe('TestToggle', () => {
    it('should render text', () => {
        render(React.createElement(CollapseToggle, { isCollapsed: true, text: "Hello, world", onToggle: noop }));
        expect(screen.getByRole('button')).toHaveTextContent('Hello, world');
    });
    it('should respect isCollapsed', () => {
        const { rerender } = render(React.createElement(CollapseToggle, { isCollapsed: false, text: "Hello, world", onToggle: noop }));
        expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument();
        rerender(React.createElement(CollapseToggle, { isCollapsed: true, text: "Hello, world", onToggle: noop }));
        expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument();
    });
    it('should call onToggle', () => {
        const onToggle = jest.fn();
        render(React.createElement(CollapseToggle, { isCollapsed: true, text: "Hello, world", onToggle: onToggle }));
        screen.getByRole('button').click();
        expect(onToggle).toHaveBeenCalledWith(false);
        // it should also not have any impact on the actual expanded state since the component does not track its own state
        expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument();
    });
});
//# sourceMappingURL=CollapseToggle.test.js.map
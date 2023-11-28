import { render, screen } from '@testing-library/react';
import React from 'react';
import { Overlay } from './Overlay';
describe('Overlay::', () => {
    it('Renders children correctly', () => {
        render(React.createElement(Overlay, { isPending: false },
            React.createElement("p", null, "Child 1"),
            React.createElement("p", null, "Child 2")));
        const wrapper = screen.getByTestId('pmm-overlay-wrapper');
        expect(wrapper.children).toHaveLength(2);
    });
    it('Renders overlay and spinner while pending', () => {
        render(React.createElement(Overlay, { isPending: true },
            React.createElement("p", null, "Test")));
        expect(screen.getByTestId('pmm-overlay-wrapper').children).toHaveLength(2);
        expect(screen.queryByTestId('overlay-spinner')).toBeInTheDocument();
    });
    it('Doesnt render overlay if not pending', () => {
        render(React.createElement(Overlay, { isPending: false },
            React.createElement("p", null, "Test")));
        expect(screen.queryByTestId('overlay-spinner')).not.toBeInTheDocument();
    });
});
//# sourceMappingURL=Overlay.test.js.map
import { render, screen } from '@testing-library/react';
import React from 'react';
import { WidgetWrapper } from './WidgetWrapper';
const Dummy = () => React.createElement("span", { "data-testid": "dummy" });
describe('WidgetWrapper', () => {
    it('render children when request is not pending', () => {
        render(React.createElement(WidgetWrapper, { title: "Title", isPending: false },
            React.createElement(Dummy, null)));
        expect(screen.getByTestId('dummy')).toBeInTheDocument();
    });
    it('not render children when request is pending', () => {
        render(React.createElement(WidgetWrapper, { title: "Title", isPending: true },
            React.createElement(Dummy, null)));
        expect(screen.queryByTestId('dummy')).not.toBeInTheDocument();
    });
    it('render title properly', () => {
        render(React.createElement(WidgetWrapper, { title: "Test title" },
            React.createElement(Dummy, null)));
        expect(screen.getByText('Test title')).toBeInTheDocument();
    });
});
//# sourceMappingURL=WidgetWrapper.test.js.map
import { render, screen } from '@testing-library/react';
import React from 'react';
import { EmptyBlock } from './EmptyBlock';
describe('EmptyBlock', () => {
    it('render external wrapper with data-testid attribute', () => {
        render(React.createElement(EmptyBlock, { dataTestId: "test-data-testid" }));
        expect(screen.getByTestId('test-data-testid')).toBeInTheDocument();
    });
    it('should render children', () => {
        render(React.createElement(EmptyBlock, { dataTestId: "test-data-testid" },
            React.createElement("span", { "data-testid": "span-test" }, "TEST")));
        expect(screen.getByTestId('span-test')).toBeInTheDocument();
    });
});
//# sourceMappingURL=EmptyBlock.test.js.map
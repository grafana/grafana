import { render, screen } from '@testing-library/react';
import React from 'react';
import { withSelectStyles } from './withSelectStyles';
const FooWrapper = () => React.createElement("div", { "data-testid": "foo-wrapper" });
describe('withSelectStyles', () => {
    it('should return component with injected className', () => {
        const Foo = withSelectStyles(FooWrapper);
        render(React.createElement(Foo, null));
        expect(screen.getByTestId('foo-wrapper').className).toBeDefined();
    });
});
//# sourceMappingURL=withSelectStyles.test.js.map
import { render, screen } from '@testing-library/react';
import React from 'react';
import { CenteredButton } from './CenteredButton';
describe('CenteredButton::', () => {
    it('should pass props to child component', () => {
        render(React.createElement(CenteredButton, { "data-testid": "foobar" }, "Test"));
        expect(screen.getAllByTestId('foobar')).toHaveLength(1);
    });
});
//# sourceMappingURL=CenteredButton.test.js.map
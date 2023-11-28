import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DBClusterConnectionPassword } from './DBClusterConnectionPassword';
import { HIDDEN_PASSWORD_LENGTH } from './DBClusterConnectionPassword.constants';
describe('DBClusterConnectionPassword::', () => {
    it('renders correctly', () => {
        const { container } = render(React.createElement(DBClusterConnectionPassword, { label: "Test", password: "1234" }));
        expect(container.querySelectorAll('div')[0].children).toHaveLength(2);
        expect(container).toHaveTextContent('Test');
        expect(container).toHaveTextContent('*'.repeat(HIDDEN_PASSWORD_LENGTH));
    });
    it('should show/hide password', () => {
        const { container } = render(React.createElement(DBClusterConnectionPassword, { label: "test label", password: "1234" }));
        const button = screen.getByTestId('show-password-button');
        expect(container).toHaveTextContent('*'.repeat(HIDDEN_PASSWORD_LENGTH));
        fireEvent.click(button);
        expect(container).toHaveTextContent('1234');
    });
});
//# sourceMappingURL=DBClusterConnectionPassword.test.js.map
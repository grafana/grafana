import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { PasswordField } from './PasswordField';
describe('PasswordField', () => {
    const props = {
        id: 'password',
        placeholder: 'enter password',
        'data-testid': 'password-field',
    };
    it('should render correctly', () => {
        render(React.createElement(PasswordField, Object.assign({}, props)));
        expect(screen.getByTestId('password-field')).toBeInTheDocument();
        expect(screen.getByRole('switch', { name: 'Show password' })).toBeInTheDocument();
    });
    it('should able to show password value if clicked on password-reveal icon', () => {
        render(React.createElement(PasswordField, Object.assign({}, props)));
        expect(screen.getByTestId('password-field')).toHaveProperty('type', 'password');
        fireEvent.click(screen.getByRole('switch', { name: 'Show password' }));
        expect(screen.getByTestId('password-field')).toHaveProperty('type', 'text');
    });
});
//# sourceMappingURL=PasswordField.test.js.map
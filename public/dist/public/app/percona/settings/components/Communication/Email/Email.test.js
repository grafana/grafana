import { render, screen } from '@testing-library/react';
import React from 'react';
import { Email } from './Email';
describe('Email::', () => {
    it('Renders with props', () => {
        render(React.createElement(Email, { settings: {
                username: 'test',
                from: 'from@mail.com',
                smarthost: 'host.com',
                hello: 'hello',
                require_tls: false,
            }, updateSettings: () => Promise.resolve(), testSettings: () => Promise.resolve() }));
        expect(screen.getByTestId('username-text-input')).toHaveProperty('value', 'test');
    });
    it('Disables apply changes on initial values', () => {
        render(React.createElement(Email, { settings: {
                username: 'test',
                from: 'from@mail.com',
                smarthost: 'host.com',
                hello: 'hello',
                require_tls: false,
            }, updateSettings: () => Promise.resolve(), testSettings: () => Promise.resolve() }));
        const buttons = screen.getAllByRole('button');
        expect(buttons[0]).toBeDisabled();
        expect(buttons[1]).toBeDisabled();
    });
    it('Disables username and password when NONE is selected', () => {
        render(React.createElement(Email, { settings: {
                from: 'from@mail.com',
                smarthost: 'host.com',
                hello: 'hello',
                require_tls: false,
            }, updateSettings: () => Promise.resolve(), testSettings: () => Promise.resolve() }));
        expect(screen.getByTestId('username-text-input')).toBeDisabled();
        expect(screen.getByTestId('password-password-input')).toBeDisabled();
    });
    it('Enabled username and password when NONE is not selected', () => {
        render(React.createElement(Email, { settings: {
                username: 'user',
                password: 'pass',
                from: 'from@mail.com',
                smarthost: 'host.com',
                hello: 'hello',
                require_tls: false,
            }, updateSettings: () => Promise.resolve(), testSettings: () => Promise.resolve() }));
        expect(screen.getByTestId('username-text-input')).not.toBeDisabled();
        expect(screen.getByTestId('password-password-input')).not.toBeDisabled();
    });
});
//# sourceMappingURL=Email.test.js.map
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Slack } from './Slack';
describe('Slack::', () => {
    it('Renders with props', () => {
        render(React.createElement(Slack, { settings: {
                url: 'test',
            }, updateSettings: () => { } }));
        expect(screen.getByTestId('url-text-input')).toHaveValue('test');
    });
    it('Disables apply changes on initial values', () => {
        render(React.createElement(Slack, { settings: {
                url: 'test',
            }, updateSettings: () => { } }));
        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
    });
    it('Calls apply changes', () => {
        const updateSettings = jest.fn();
        render(React.createElement(Slack, { settings: {
                url: 'test',
            }, updateSettings: updateSettings }));
        const input = screen.getByTestId('url-text-input');
        fireEvent.change(input, { target: { value: 'new key' } });
        fireEvent.submit(screen.getByTestId('slack-form'));
        expect(updateSettings).toHaveBeenCalled();
    });
});
//# sourceMappingURL=Slack.test.js.map
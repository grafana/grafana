import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Form } from 'react-final-form';
import { Icon } from '@grafana/ui';
import { SecretToggler } from './SecretToggler';
jest.mock('@grafana/ui', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/ui')), { Icon: jest.fn((props) => React.createElement("div", Object.assign({ "data-testid": "icon" }, props))) })));
describe('SecretToggler', () => {
    it('should render hidden characters by default', () => {
        render(React.createElement(Form, { onSubmit: jest.fn(), render: () => React.createElement(SecretToggler, { small: true, secret: "secret" }) }));
        expect(screen.getByTestId('small-secret-holder')).toHaveTextContent('******');
    });
    it('should show the eye icon when not showing text', () => {
        render(React.createElement(Form, { onSubmit: jest.fn(), render: () => React.createElement(SecretToggler, { secret: "secret" }) }));
        expect(Icon).toHaveBeenCalledWith(expect.objectContaining({ name: 'eye' }), expect.anything());
    });
    it('should reveal the secret when the eye is clicked', () => {
        render(React.createElement(Form, { onSubmit: jest.fn(), render: () => React.createElement(SecretToggler, { small: true, secret: "secret" }) }));
        const icon = screen.getByTestId('icon');
        expect(Icon).toHaveBeenCalledWith(expect.objectContaining({ name: 'eye' }), expect.anything());
        fireEvent.click(icon);
        expect(Icon).toHaveBeenCalledWith(expect.objectContaining({ name: 'eye-slash' }), expect.anything());
        expect(screen.getByTestId('small-secret-holder')).toHaveTextContent('secret');
    });
    it('should show a TextInputField when not small', () => {
        render(React.createElement(Form, { onSubmit: jest.fn(), render: () => React.createElement(SecretToggler, { secret: "secret" }) }));
        expect(screen.getByTestId('secret-text-input')).toBeInTheDocument();
    });
});
//# sourceMappingURL=SecretToggler.test.js.map
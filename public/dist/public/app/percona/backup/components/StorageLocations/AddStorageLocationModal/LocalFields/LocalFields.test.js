import { render, screen } from '@testing-library/react';
import React from 'react';
import { Form } from 'react-final-form';
import { LocalFields } from './LocalFields';
describe('LocalFields', () => {
    it('should pass initial values', () => {
        render(React.createElement(Form, { onSubmit: jest.fn(), render: () => React.createElement(LocalFields, { name: "server", path: "/foo" }) }));
        expect(screen.getByRole('textbox')).toHaveValue('/foo');
    });
});
//# sourceMappingURL=LocalFields.test.js.map
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SelectField } from './SelectField';
describe('SelectField', () => {
    it('should render', () => {
        render(React.createElement(SelectField, { label: "label", name: "name", onChange: jest.fn() }));
        expect(screen.queryByText('label')).toBeInTheDocument();
    });
});
//# sourceMappingURL=SelectField.test.js.map
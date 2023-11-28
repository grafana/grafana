import { render, screen } from '@testing-library/react';
import React from 'react';
import { MultiSelectField } from './MultiSelectField';
describe('MultiSelectField', () => {
    it('should render', () => {
        render(React.createElement(MultiSelectField, { label: "label", name: "name", onChange: jest.fn() }));
        expect(screen.queryByText('label')).toBeInTheDocument();
    });
});
//# sourceMappingURL=MultiSelectField.test.js.map
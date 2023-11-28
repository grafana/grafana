import { render, screen } from '@testing-library/react';
import React from 'react';
import { AsyncSelectField } from './AsyncSelectField';
jest.mock('@grafana/ui', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/ui')), { AsyncSelect: jest.fn(() => React.createElement("div", { "data-testid": "async-select" })) })));
describe('AsyncSelectField', () => {
    it('should render', () => {
        render(React.createElement(AsyncSelectField, { label: "label", name: "name", onChange: jest.fn() }));
        expect(screen.getByTestId('name-select-label')).toBeInTheDocument();
        expect(screen.getByTestId('async-select')).toBeInTheDocument();
    });
});
//# sourceMappingURL=AsyncSelectField.test.js.map
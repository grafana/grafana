import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { createLokiDatasource } from '../../mocks';
import MonacoQueryField from './MonacoQueryField';
function renderComponent({ initialValue = '', onRunQuery = jest.fn(), onBlur = jest.fn(), onChange = jest.fn(), } = {}) {
    const datasource = createLokiDatasource();
    render(React.createElement(MonacoQueryField, { datasource: datasource, initialValue: initialValue, history: [], onRunQuery: onRunQuery, onBlur: onBlur, onChange: onChange, placeholder: "Enter a Loki query (run with Shift+Enter)" }));
}
describe('MonacoQueryField', () => {
    test('Renders with no errors', () => __awaiter(void 0, void 0, void 0, function* () {
        renderComponent();
        expect(yield screen.findByText('Loading...')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=MonacoQueryField.test.js.map
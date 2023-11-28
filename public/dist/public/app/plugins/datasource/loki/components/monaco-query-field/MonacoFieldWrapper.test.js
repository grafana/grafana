import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { createLokiDatasource } from '../../mocks';
import { MonacoQueryFieldWrapper } from './MonacoQueryFieldWrapper';
function renderComponent({ initialValue = '', onChange = jest.fn(), onRunQuery = jest.fn() } = {}) {
    const datasource = createLokiDatasource();
    render(React.createElement(MonacoQueryFieldWrapper, { datasource: datasource, history: [], initialValue: initialValue, onChange: onChange, onRunQuery: onRunQuery, placeholder: "Enter a Loki query (run with Shift+Enter)" }));
}
describe('MonacoFieldWrapper', () => {
    test('Renders with no errors', () => __awaiter(void 0, void 0, void 0, function* () {
        renderComponent();
        expect(yield screen.findByText('Loading...')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=MonacoFieldWrapper.test.js.map
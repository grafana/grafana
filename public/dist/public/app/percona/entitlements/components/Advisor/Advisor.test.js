import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Advisor } from './Advisor';
describe('Advisor', () => {
    test('renders Advisor with label and checked icon', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Advisor, { label: "Test label", hasAdvisor: true }));
        expect(screen.getByTestId('advisor-check-icon')).toBeInTheDocument();
        expect(screen.getByText(/Test label/i)).toBeInTheDocument();
    }));
    test('renders Advisor with label and times icon', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Advisor, { label: "Test label", hasAdvisor: false }));
        expect(screen.getByTestId('advisor-times-icon')).toBeInTheDocument();
        expect(screen.getByText(/Test label/i)).toBeInTheDocument();
    }));
});
//# sourceMappingURL=Advisor.test.js.map
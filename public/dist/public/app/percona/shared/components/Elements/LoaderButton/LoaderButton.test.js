import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { LoaderButton } from './LoaderButton';
const buttonLabel = 'Test button';
describe('LoaderButton::', () => {
    it('should display a spinner when in loading state, not button text', () => __awaiter(void 0, void 0, void 0, function* () {
        const { container } = render(React.createElement(LoaderButton, { loading: true }, "Loading test"));
        expect(yield screen.findByRole('button')).toBeInTheDocument();
        expect(yield screen.queryByText('Loading test')).not.toBeInTheDocument();
        expect(container.querySelectorAll('i').length).toEqual(1);
    }));
    it('should display the children if not in loading state', () => __awaiter(void 0, void 0, void 0, function* () {
        const { container } = render(React.createElement(LoaderButton, null, buttonLabel));
        expect(yield screen.findByRole('button')).toBeInTheDocument();
        expect(yield screen.queryByText(buttonLabel)).toBeInTheDocument();
        expect(container.querySelectorAll('i').length).toEqual(0);
    }));
});
//# sourceMappingURL=LoaderButton.test.js.map
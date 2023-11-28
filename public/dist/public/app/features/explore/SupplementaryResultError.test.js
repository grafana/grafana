import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { SupplementaryResultError } from './SupplementaryResultError';
describe('SupplementaryResultError', () => {
    it('shows short warning message', () => {
        const error = { data: { message: 'Test error message' } };
        const title = 'Error loading supplementary query';
        render(React.createElement(SupplementaryResultError, { error: error, title: title }));
        expect(screen.getByText(title)).toBeInTheDocument();
        expect(screen.getByText(error.data.message)).toBeInTheDocument();
    });
    it('shows long warning message', () => __awaiter(void 0, void 0, void 0, function* () {
        // we make a long message
        const messagePart = 'One two three four five six seven eight nine ten.';
        const message = messagePart.repeat(3);
        const error = { data: { message } };
        const title = 'Error loading supplementary query';
        render(React.createElement(SupplementaryResultError, { error: error, title: title }));
        expect(screen.getByText(title)).toBeInTheDocument();
        expect(screen.queryByText(message)).not.toBeInTheDocument();
        const button = screen.getByText('Show details');
        yield userEvent.click(button);
        expect(screen.getByText(message)).toBeInTheDocument();
    }));
});
//# sourceMappingURL=SupplementaryResultError.test.js.map
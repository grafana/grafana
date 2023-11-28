import { __awaiter } from "tslib";
import { screen, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AlertLabels } from './AlertLabels';
describe('AlertLabels', () => {
    it('should toggle show / hide common labels', () => __awaiter(void 0, void 0, void 0, function* () {
        const labels = { foo: 'bar', bar: 'baz', baz: 'qux' };
        const commonLabels = { foo: 'bar', baz: 'qux' };
        render(React.createElement(AlertLabels, { labels: labels, commonLabels: commonLabels }));
        expect(screen.getByText('+2 common labels')).toBeInTheDocument();
        userEvent.click(screen.getByRole('button'));
        yield waitFor(() => {
            expect(screen.getByText('Hide common labels')).toBeInTheDocument();
        });
        userEvent.click(screen.getByRole('button'));
        yield waitFor(() => {
            expect(screen.getByText('+2 common labels')).toBeInTheDocument();
        });
    }));
});
//# sourceMappingURL=AlertLabels.test.js.map
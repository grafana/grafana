import { __awaiter } from "tslib";
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { MultipleActions } from './MultipleActions';
describe('MultipleActions::', () => {
    it('renders correctly with actions', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MultipleActions, { actions: [
                {
                    content: 'Test action 1',
                    action: jest.fn(),
                },
                {
                    content: 'Test action 2',
                    action: jest.fn(),
                },
            ] }));
        const btn = screen.getByTestId('dropdown-menu-toggle');
        yield waitFor(() => fireEvent.click(btn));
        expect(screen.getAllByTestId('dropdown-button')).toHaveLength(2);
    }));
    it('renders correctly disabled', () => {
        render(React.createElement(MultipleActions, { actions: [], disabled: true }));
        expect(screen.getByTestId('dropdown-menu-toggle')).toBeDisabled();
    });
});
//# sourceMappingURL=MultipleActions.test.js.map
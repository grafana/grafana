import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { noop } from 'lodash';
import React from 'react';
import { SecondaryActions } from './SecondaryActions';
describe('SecondaryActions', () => {
    it('should render component with three buttons', () => {
        render(React.createElement(SecondaryActions, { onClickAddQueryRowButton: noop, onClickRichHistoryButton: noop, onClickQueryInspectorButton: noop }));
        expect(screen.getByRole('button', { name: /Add query/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Query history/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Query inspector/i })).toBeInTheDocument();
    });
    it('should not render hidden elements', () => {
        render(React.createElement(SecondaryActions, { addQueryRowButtonHidden: true, richHistoryRowButtonHidden: true, onClickAddQueryRowButton: noop, onClickRichHistoryButton: noop, onClickQueryInspectorButton: noop }));
        expect(screen.queryByRole('button', { name: /Add query/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Query history/i })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Query inspector/i })).toBeInTheDocument();
    });
    it('should disable add row button if addQueryRowButtonDisabled=true', () => {
        render(React.createElement(SecondaryActions, { addQueryRowButtonDisabled: true, onClickAddQueryRowButton: noop, onClickRichHistoryButton: noop, onClickQueryInspectorButton: noop }));
        expect(screen.getByRole('button', { name: /Add query/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Query history/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Query inspector/i })).toBeInTheDocument();
    });
    it('should map click handlers correctly', () => __awaiter(void 0, void 0, void 0, function* () {
        const user = userEvent.setup();
        const onClickAddRow = jest.fn();
        const onClickHistory = jest.fn();
        const onClickQueryInspector = jest.fn();
        render(React.createElement(SecondaryActions, { onClickAddQueryRowButton: onClickAddRow, onClickRichHistoryButton: onClickHistory, onClickQueryInspectorButton: onClickQueryInspector }));
        yield user.click(screen.getByRole('button', { name: /Add query/i }));
        expect(onClickAddRow).toBeCalledTimes(1);
        yield user.click(screen.getByRole('button', { name: /Query history/i }));
        expect(onClickHistory).toBeCalledTimes(1);
        yield user.click(screen.getByRole('button', { name: /Query inspector/i }));
        expect(onClickQueryInspector).toBeCalledTimes(1);
    }));
});
//# sourceMappingURL=SecondaryActions.test.js.map
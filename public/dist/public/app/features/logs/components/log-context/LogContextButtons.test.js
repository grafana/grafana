import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { LogContextButtons } from './LogContextButtons';
describe('LogContextButtons', () => {
    it('should call onChangeWrapLines when the checkbox is used, case 1', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChangeWrapLines = jest.fn();
        render(React.createElement(LogContextButtons, { onChangeWrapLines: onChangeWrapLines, onScrollCenterClick: jest.fn() }));
        const wrapLinesBox = screen.getByRole('checkbox', {
            name: 'Wrap lines',
        });
        yield userEvent.click(wrapLinesBox);
        expect(onChangeWrapLines).toHaveBeenCalledTimes(1);
        expect(onChangeWrapLines).toHaveBeenCalledWith(true);
    }));
    it('should call onChangeWrapLines when the checkbox is used, case 2', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChangeWrapLines = jest.fn();
        render(React.createElement(LogContextButtons, { onChangeWrapLines: onChangeWrapLines, onScrollCenterClick: jest.fn(), wrapLines: true }));
        const wrapLinesBox = screen.getByRole('checkbox', {
            name: 'Wrap lines',
        });
        yield userEvent.click(wrapLinesBox);
        expect(onChangeWrapLines).toHaveBeenCalledTimes(1);
        expect(onChangeWrapLines).toHaveBeenCalledWith(false);
    }));
    it('should call onScrollCenterClick when the button is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        const onScrollCenterClick = jest.fn();
        render(React.createElement(LogContextButtons, { onChangeWrapLines: jest.fn(), onScrollCenterClick: onScrollCenterClick }));
        const scrollButton = screen.getByRole('button');
        yield userEvent.click(scrollButton);
        expect(onScrollCenterClick).toHaveBeenCalledTimes(1);
    }));
});
//# sourceMappingURL=LogContextButtons.test.js.map
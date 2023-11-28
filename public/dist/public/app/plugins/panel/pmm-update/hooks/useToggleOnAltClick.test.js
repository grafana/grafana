/* eslint-disable @typescript-eslint/no-explicit-any */
import { __awaiter } from "tslib";
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { useToggleOnAltClick } from './useToggleOnAltClick';
const HookWrapper = () => {
    const [toggleValue, handler] = useToggleOnAltClick();
    return (React.createElement(React.Fragment, null,
        toggleValue && React.createElement("span", { "data-testid": "hook-wrapper-toggle" }),
        React.createElement("button", { "data-testid": "hook-wrapper-handler", onClick: handler })));
};
describe('useToggleOnAltClick', () => {
    it('should toggle a boolean value on alt+click on a compunent using the returned handler', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(HookWrapper, null));
        expect(screen.queryByTestId('hook-wrapper-toggle')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('hook-wrapper-handler'), { altKey: true });
        expect(screen.queryByTestId('hook-wrapper-toggle')).toBeInTheDocument();
    }));
    it('should do nothing if alt is not pressed while clicking', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(HookWrapper, null));
        expect(screen.queryByTestId('hook-wrapper-toggle')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('hook-wrapper-handler'), { altKey: false });
        expect(screen.queryByTestId('hook-wrapper-toggle')).not.toBeInTheDocument();
    }));
});
//# sourceMappingURL=useToggleOnAltClick.test.js.map
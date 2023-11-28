import { __awaiter } from "tslib";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent } from '@testing-library/react';
import React, { createRef } from 'react';
import { useClickOutside } from './useClickOutside';
const HookWrapper = ({ hook }) => {
    const dataHook = hook ? hook() : undefined;
    return React.createElement("div", { "data-hook": dataHook });
};
describe('useClickOutside', () => {
    it('should call the passed handler when clicked outside the passed ref or if Esc is pressed', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockedHandler = jest.fn();
        const parent = document.createElement('div');
        const ref = createRef();
        document.body.appendChild(parent);
        render(React.createElement("div", { "data-testid": "referred", ref: ref }), { container: parent });
        render(React.createElement(HookWrapper, { hook: () => useClickOutside(ref, mockedHandler) }));
        const referredElement = screen.getByTestId('referred');
        fireEvent.click(referredElement);
        expect(mockedHandler).not.toBeCalled();
        fireEvent.click(parent);
        expect(mockedHandler).toBeCalledTimes(1);
        fireEvent.keyDown(referredElement, { key: 'Escape' });
        expect(mockedHandler).toBeCalledTimes(2);
        fireEvent.keyDown(referredElement, { key: 'Escape' });
        expect(mockedHandler).toBeCalledTimes(3);
        fireEvent.keyDown(parent, { key: 'A' });
        expect(mockedHandler).toBeCalledTimes(3);
        fireEvent.keyDown(parent, { key: 'A' });
        expect(mockedHandler).toBeCalledTimes(3);
    }));
});
//# sourceMappingURL=useClickOutside.test.js.map
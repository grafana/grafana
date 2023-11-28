import { __awaiter } from "tslib";
import { render, screen, fireEvent } from '@testing-library/react';
import axios from 'axios';
import React from 'react';
import { useCancelToken } from './cancelToken.hook';
const FIRST_CANCEL_TOKEN = 'firstRequest';
const SECOND_CANCEL_TOKEN = 'secondRequest';
jest.mock('axios', () => ({
    __esModule: true,
    default: {
        CancelToken: {
            source: jest.fn(),
        },
    },
}));
const cancelSpy = jest.fn();
const sourceSpy = jest.fn().mockImplementation(() => ({ cancel: cancelSpy }));
jest.spyOn(axios.CancelToken, 'source').mockImplementation(sourceSpy);
const Dummy = () => {
    const [generateToken, cancelToken] = useCancelToken();
    return (React.createElement(React.Fragment, null,
        React.createElement("button", { onClick: () => generateToken(FIRST_CANCEL_TOKEN) }),
        React.createElement("button", { onClick: () => generateToken(SECOND_CANCEL_TOKEN) }),
        React.createElement("button", { onClick: () => cancelToken(FIRST_CANCEL_TOKEN) })));
};
describe('useCancelToken', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });
    it('should cancel previous identical requests', () => {
        render(React.createElement(Dummy, null));
        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[0]);
        fireEvent.click(buttons[0]);
        fireEvent.click(buttons[0]);
        expect(sourceSpy).toHaveBeenCalledTimes(3);
        expect(cancelSpy).toHaveBeenCalledTimes(2);
    });
    it('should keep different requests', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Dummy, null));
        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[0]);
        fireEvent.click(buttons[0]);
        fireEvent.click(buttons[0]);
        fireEvent.click(buttons[1]);
        fireEvent.click(buttons[1]);
        expect(sourceSpy).toHaveBeenCalledTimes(5);
        expect(cancelSpy).toHaveBeenCalledTimes(4);
    }));
    it('should clean all requests on unmount', () => {
        const { unmount } = render(React.createElement(Dummy, null));
        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[0]);
        fireEvent.click(buttons[0]);
        fireEvent.click(buttons[0]);
        fireEvent.click(buttons[1]);
        fireEvent.click(buttons[1]);
        unmount();
        expect(cancelSpy).toHaveBeenCalledTimes(7);
    });
    it('should explicitly cancel a token', () => {
        render(React.createElement(Dummy, null));
        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[0]);
        fireEvent.click(buttons[1]);
        fireEvent.click(buttons[2]);
        expect(cancelSpy).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=cancelToken.hook.test.js.map
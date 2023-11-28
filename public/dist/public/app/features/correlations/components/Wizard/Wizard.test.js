import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Wizard } from './Wizard';
const MockPage1 = () => React.createElement("span", null, "Page 1");
const MockPage2 = () => React.createElement("span", null, "Page 2");
const MockNavigation = () => (React.createElement("span", null,
    React.createElement("button", { type: "submit" }, "next")));
const onSubmitMock = jest.fn();
describe('Wizard', () => {
    beforeEach(() => {
        render(React.createElement(Wizard, { pages: [MockPage1, MockPage2], navigation: MockNavigation, onSubmit: onSubmitMock }));
    });
    afterEach(() => {
        onSubmitMock.mockReset();
    });
    it('Renders each page and submits at the end', () => __awaiter(void 0, void 0, void 0, function* () {
        expect(screen.queryByText('Page 1')).toBeInTheDocument();
        expect(screen.queryByText('Page 2')).not.toBeInTheDocument();
        yield userEvent.click(yield screen.findByRole('button', { name: /next$/i }));
        expect(onSubmitMock).not.toBeCalled();
        expect(screen.queryByText('Page 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Page 2')).toBeInTheDocument();
        yield userEvent.click(yield screen.findByRole('button', { name: /next$/i }));
        expect(onSubmitMock).toBeCalled();
    }));
});
//# sourceMappingURL=Wizard.test.js.map
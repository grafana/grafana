import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { NewsContainer } from './NewsContainer';
const setup = () => {
    const { container } = render(React.createElement(NewsContainer, null));
    return { container };
};
describe('News', () => {
    it('should render the drawer when the drawer button is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        yield userEvent.click(screen.getByRole('button'));
        expect(screen.getByText('Latest from the blog')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=NewsContainer.test.js.map
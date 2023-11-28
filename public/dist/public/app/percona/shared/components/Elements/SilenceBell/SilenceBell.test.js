import { __awaiter } from "tslib";
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SilenceBell } from './SilenceBell';
describe('SilenceBell', () => {
    it('should not show the spinner initially', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(SilenceBell, { silenced: false }));
        expect(yield screen.findByRole('button')).toBeInTheDocument();
    }));
    it('should show the spinner after clicking the button and remove it after the function is done', () => __awaiter(void 0, void 0, void 0, function* () {
        const callback = () => __awaiter(void 0, void 0, void 0, function* () { return null; });
        render(React.createElement(SilenceBell, { silenced: false, onClick: callback }));
        const button = yield screen.findByRole('button');
        fireEvent.click(button);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(yield screen.findByRole('button')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=SilenceBell.test.js.map
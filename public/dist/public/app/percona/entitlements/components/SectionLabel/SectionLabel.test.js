import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Label } from './SectionLabel';
describe('SectionLabel', () => {
    test('renders SectionLabel with expiry date', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Label, { name: "Expiry Date", endDate: "28/10/2019" }));
        expect(screen.getByText(/Expiry date: 28\/10\/2019/i)).toBeInTheDocument();
    }));
});
//# sourceMappingURL=SectionLabel.test.js.map
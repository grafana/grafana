import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import AdvancedMulti from './AdvancedMulti';
describe('AdvancedMulti', () => {
    it('should expand and render a section', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const renderAdvanced = jest.fn().mockReturnValue(React.createElement("div", null, "details!"));
        render(React.createElement(AdvancedMulti, { onChange: onChange, resources: [{}], renderAdvanced: renderAdvanced }));
        const advancedSection = screen.getByText('Advanced');
        yield userEvent.click(advancedSection);
        expect(yield screen.findByText('details!')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=AdvancedMulti.test.js.map
import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Icon } from './Icon';
describe('Icon::', () => {
    it('should display the correct icon', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Icon, { name: "plusSquare", role: "img" }));
        expect(yield screen.findByRole('img')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=Icon.test.js.map
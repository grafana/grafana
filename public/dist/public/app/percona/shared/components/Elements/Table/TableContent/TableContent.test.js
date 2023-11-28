import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TableContent } from './TableContent';
describe('TableContent', () => {
    it('should display the noData section when no data is passed', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(TableContent, { hasData: false, emptyMessage: "empty" }));
        const noData = screen.getByTestId('table-no-data');
        expect(noData).toBeInTheDocument();
        expect(noData).toHaveTextContent('empty');
    }));
    it('should not display the noData section when no data is passed and it is still loading', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(TableContent, { loading: true, hasData: false, emptyMessage: "empty" }));
        const noData = screen.getByTestId('table-no-data');
        expect(noData).toBeInTheDocument();
        expect(noData.textContent).toHaveLength(0);
    }));
    it('should display the table when there is data', () => __awaiter(void 0, void 0, void 0, function* () {
        const Dummy = () => React.createElement("span", { "data-testid": "dummy" });
        render(React.createElement(TableContent, { hasData: true, emptyMessage: "no data" },
            React.createElement(Dummy, null)));
        expect(screen.queryByTestId('table-no-data')).not.toBeInTheDocument();
        expect(screen.getByTestId('dummy')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=TableContent.test.js.map
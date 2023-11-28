import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { PageContent } from './PageContent';
describe('PageContent', () => {
    it('should display the noData section when no data is passed', () => __awaiter(void 0, void 0, void 0, function* () {
        yield render(React.createElement(PageContent, { hasData: false, emptyMessage: "empty" }));
        expect(screen.getByTestId('page-no-data')).toBeInTheDocument();
        expect(screen.getByText('empty')).toBeInTheDocument();
    }));
    it('should not display the noData section when no data is passed and it is still loading', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(PageContent, { loading: true, hasData: false, emptyMessage: "empty" }));
        expect(screen.getByTestId('page-no-data')).toBeInTheDocument();
        expect(screen.queryByText('empty')).not.toBeInTheDocument();
    }));
    it('should display the page when there is data', () => __awaiter(void 0, void 0, void 0, function* () {
        const Dummy = () => React.createElement("span", { "data-testid": "dummy" });
        render(React.createElement(PageContent, { hasData: true, emptyMessage: "no data" },
            React.createElement(Dummy, null)));
        expect(screen.queryByTestId('page-no-data')).not.toBeInTheDocument();
        expect(screen.getByTestId('dummy')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=PageContent.test.js.map
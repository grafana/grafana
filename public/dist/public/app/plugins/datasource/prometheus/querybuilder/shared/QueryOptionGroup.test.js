import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QueryOptionGroup } from './QueryOptionGroup';
describe('Query size approximation', () => {
    const _1KiB = 1024; // size of 1 KiB in bytes
    const _1GiB = 1073741824; // ...
    const _1PiB = 1125899906842624;
    it('renders the correct data value given 1 KiB', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = createProps(_1KiB);
        render(React.createElement(QueryOptionGroup, Object.assign({}, props)));
        expect(screen.getByText(/This query will process approximately 1.0 KiB/)).toBeInTheDocument();
    }));
    it('renders the correct data value given 1 GiB', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = createProps(_1GiB);
        render(React.createElement(QueryOptionGroup, Object.assign({}, props)));
        expect(screen.getByText(/This query will process approximately 1.0 GiB/)).toBeInTheDocument();
    }));
    it('renders the correct data value given 1 PiB', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = createProps(_1PiB);
        render(React.createElement(QueryOptionGroup, Object.assign({}, props)));
        expect(screen.getByText(/This query will process approximately 1.0 PiB/)).toBeInTheDocument();
    }));
    it('updates the data value on data change', () => __awaiter(void 0, void 0, void 0, function* () {
        const props1 = createProps(_1KiB);
        const props2 = createProps(_1PiB);
        const { rerender } = render(React.createElement(QueryOptionGroup, Object.assign({}, props1)));
        expect(screen.getByText(/This query will process approximately 1.0 KiB/)).toBeInTheDocument();
        rerender(React.createElement(QueryOptionGroup, Object.assign({}, props2)));
        expect(screen.getByText(/This query will process approximately 1.0 PiB/)).toBeInTheDocument();
    }));
});
function createProps(bytes) {
    return {
        title: 'Options',
        collapsedInfo: ['Type: Range', 'Line limit: 1000'],
        children: React.createElement("div", null),
        queryStats: { streams: 0, chunks: 0, bytes: bytes !== null && bytes !== void 0 ? bytes : 0, entries: 0 },
    };
}
//# sourceMappingURL=QueryOptionGroup.test.js.map
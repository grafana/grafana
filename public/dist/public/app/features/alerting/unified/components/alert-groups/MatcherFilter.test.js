import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import lodash from 'lodash'; // eslint-disable-line lodash/import-scope
import React from 'react';
import * as runtime from '@grafana/runtime';
import { LogMessages } from '../../Analytics';
import { MatcherFilter } from './MatcherFilter';
const logInfoSpy = jest.spyOn(runtime, 'logInfo');
describe('Analytics', () => {
    beforeEach(() => {
        lodash.debounce = jest.fn().mockImplementation((fn) => {
            fn.cancel = () => { };
            return fn;
        });
    });
    it('Sends log info when filtering alert instances by label', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MatcherFilter, { onFilterChange: jest.fn() }));
        const searchInput = screen.getByTestId('search-query-input');
        yield userEvent.type(searchInput, 'job=');
        expect(logInfoSpy).toHaveBeenCalledWith(LogMessages.filterByLabel);
    }));
    it('should call onChange handler', () => __awaiter(void 0, void 0, void 0, function* () {
        const onFilterMock = jest.fn();
        render(React.createElement(MatcherFilter, { defaultQueryString: "foo", onFilterChange: onFilterMock }));
        const searchInput = screen.getByTestId('search-query-input');
        yield userEvent.type(searchInput, '=bar');
        expect(onFilterMock).toHaveBeenLastCalledWith('foo=bar');
    }));
});
//# sourceMappingURL=MatcherFilter.test.js.map
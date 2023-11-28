import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// eslint-disable-next-line lodash/import-scope
import lodash from 'lodash';
import React from 'react';
import Search from './Search';
const defaultProps = {
    searchPhrase: '',
    searchFn: jest.fn(),
};
const originalDebounce = lodash.debounce;
describe('Search', () => {
    beforeEach(() => {
        lodash.debounce = jest.fn().mockImplementation((fn) => {
            fn.cancel = () => { };
            return fn;
        });
    });
    afterEach(() => {
        lodash.debounce = originalDebounce;
    });
    it('displays the search phrase passed in if it exists', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Search, Object.assign({}, defaultProps, { searchPhrase: 'testPhrase' })));
        expect(yield screen.findByDisplayValue('testPhrase')).toBeInTheDocument();
    }));
    it('displays placeholder text if search phrase is not passed in', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Search, Object.assign({}, defaultProps)));
        expect(yield screen.findByPlaceholderText('search by log group name prefix')).toBeInTheDocument();
    }));
    it('calls a debounced version of searchFn when typed in', () => __awaiter(void 0, void 0, void 0, function* () {
        const searchFn = jest.fn();
        render(React.createElement(Search, Object.assign({}, defaultProps, { searchFn: searchFn })));
        yield userEvent.type(yield screen.findByLabelText('log group search'), 'something');
        expect(searchFn).toBeCalledWith('s');
        expect(searchFn).toHaveBeenLastCalledWith('something');
    }));
});
//# sourceMappingURL=Search.test.js.map
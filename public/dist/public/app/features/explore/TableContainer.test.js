import { __assign } from "tslib";
import React from 'react';
import { render, shallow } from 'enzyme';
import { TableContainer } from './TableContainer';
import { ExploreId } from 'app/types/explore';
describe('TableContainer', function () {
    it('should render component', function () {
        var props = {
            exploreId: ExploreId.left,
            loading: false,
            width: 800,
            onCellFilterAdded: jest.fn(),
            tableResult: {},
            splitOpen: (function () { }),
            range: {},
        };
        var wrapper = shallow(React.createElement(TableContainer, __assign({}, props)));
        expect(wrapper).toMatchSnapshot();
    });
    it('should render 0 series returned on no items', function () {
        var props = {
            exploreId: ExploreId.left,
            loading: false,
            width: 800,
            onCellFilterAdded: jest.fn(),
            tableResult: {
                name: 'TableResultName',
                fields: [],
                length: 0,
            },
            splitOpen: (function () { }),
            range: {},
        };
        var wrapper = render(React.createElement(TableContainer, __assign({}, props)));
        expect(wrapper.find('0 series returned')).toBeTruthy();
    });
});
//# sourceMappingURL=TableContainer.test.js.map
import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import OrgActionBar from './OrgActionBar';
var setup = function (propOverrides) {
    var props = {
        searchQuery: '',
        setSearchQuery: jest.fn(),
        target: '_blank',
        linkButton: { href: 'some/url', title: 'test' },
    };
    Object.assign(props, propOverrides);
    return shallow(React.createElement(OrgActionBar, tslib_1.__assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=OrgActionBar.test.js.map
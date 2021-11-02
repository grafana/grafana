import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import PageActionBar from './PageActionBar';
var setup = function (propOverrides) {
    var props = {
        searchQuery: '',
        setSearchQuery: jest.fn(),
        target: '_blank',
        linkButton: { href: 'some/url', title: 'test' },
    };
    Object.assign(props, propOverrides);
    return shallow(React.createElement(PageActionBar, __assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=PageActionBar.test.js.map
import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import OrgProfile from './OrgProfile';
var setup = function () {
    var props = {
        orgName: 'Main org',
        onSubmit: jest.fn(),
        onOrgNameChange: jest.fn(),
    };
    return shallow(React.createElement(OrgProfile, tslib_1.__assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=OrgProfile.test.js.map
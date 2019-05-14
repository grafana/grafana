import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import InviteesTable from './InviteesTable';
import { getMockInvitees } from './__mocks__/userMocks';
var setup = function (propOverrides) {
    var props = {
        invitees: [],
    };
    Object.assign(props, propOverrides);
    return shallow(React.createElement(InviteesTable, tslib_1.__assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
    it('should render invitees', function () {
        var wrapper = setup({
            invitees: getMockInvitees(5),
        });
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=InviteesTable.test.js.map
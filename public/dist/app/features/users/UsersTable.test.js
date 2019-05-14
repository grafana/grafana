import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import UsersTable from './UsersTable';
import { getMockUsers } from './__mocks__/userMocks';
var setup = function (propOverrides) {
    var props = {
        users: [],
        onRoleChange: jest.fn(),
        onRemoveUser: jest.fn(),
    };
    Object.assign(props, propOverrides);
    return shallow(React.createElement(UsersTable, tslib_1.__assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
    it('should render users table', function () {
        var wrapper = setup({
            users: getMockUsers(5),
        });
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=UsersTable.test.js.map
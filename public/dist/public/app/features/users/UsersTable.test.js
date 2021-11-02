import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import UsersTable from './UsersTable';
import { getMockUsers } from './__mocks__/userMocks';
import { ConfirmModal } from '@grafana/ui';
jest.mock('app/core/core', function () { return ({
    contextSrv: {
        hasPermission: function () { return true; },
    },
}); });
var setup = function (propOverrides) {
    var props = {
        users: [],
        onRoleChange: jest.fn(),
        onRemoveUser: jest.fn(),
    };
    Object.assign(props, propOverrides);
    return shallow(React.createElement(UsersTable, __assign({}, props)));
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
describe('Remove modal', function () {
    it('should render correct amount', function () {
        var wrapper = setup({
            users: getMockUsers(3),
        });
        expect(wrapper.find(ConfirmModal).length).toEqual(4);
    });
});
//# sourceMappingURL=UsersTable.test.js.map
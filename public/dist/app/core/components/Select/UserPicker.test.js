import React from 'react';
import renderer from 'react-test-renderer';
import { UserPicker } from './UserPicker';
jest.mock('app/core/services/backend_srv', function () { return ({
    getBackendSrv: function () {
        return {
            get: function () {
                return Promise.resolve([]);
            },
        };
    },
}); });
describe('UserPicker', function () {
    it('renders correctly', function () {
        var tree = renderer.create(React.createElement(UserPicker, { onSelected: function () { } })).toJSON();
        expect(tree).toMatchSnapshot();
    });
});
//# sourceMappingURL=UserPicker.test.js.map
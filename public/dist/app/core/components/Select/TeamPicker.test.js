import * as tslib_1 from "tslib";
import React from 'react';
import renderer from 'react-test-renderer';
import { TeamPicker } from './TeamPicker';
jest.mock('app/core/services/backend_srv', function () { return ({
    getBackendSrv: function () {
        return {
            get: function () {
                return Promise.resolve([]);
            },
        };
    },
}); });
describe('TeamPicker', function () {
    it('renders correctly', function () {
        var props = {
            onSelected: function () { },
        };
        var tree = renderer.create(React.createElement(TeamPicker, tslib_1.__assign({}, props))).toJSON();
        expect(tree).toMatchSnapshot();
    });
});
//# sourceMappingURL=TeamPicker.test.js.map
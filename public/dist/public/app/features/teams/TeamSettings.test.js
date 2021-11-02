import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { TeamSettings } from './TeamSettings';
import { getMockTeam } from './__mocks__/teamMocks';
var setup = function (propOverrides) {
    var props = {
        team: getMockTeam(),
        updateTeam: jest.fn(),
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(TeamSettings, __assign({}, props)));
    var instance = wrapper.instance();
    return {
        wrapper: wrapper,
        instance: instance,
    };
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup().wrapper;
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=TeamSettings.test.js.map
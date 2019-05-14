import * as tslib_1 from "tslib";
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
    var wrapper = shallow(React.createElement(TeamSettings, tslib_1.__assign({}, props)));
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
describe('Functions', function () {
    it('should update team', function () {
        var instance = setup().instance;
        var mockEvent = { preventDefault: jest.fn() };
        instance.setState({
            name: 'test11',
        });
        instance.onUpdate(mockEvent);
        expect(instance.props.updateTeam).toHaveBeenCalledWith('test11', 'test@test.com');
    });
});
//# sourceMappingURL=TeamSettings.test.js.map
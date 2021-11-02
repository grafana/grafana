import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { CreateTeam } from './CreateTeam';
describe('Render', function () {
    it('should render component', function () {
        var props = {
            navModel: {},
        };
        var wrapper = shallow(React.createElement(CreateTeam, __assign({}, props)));
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=CreateTeam.test.js.map
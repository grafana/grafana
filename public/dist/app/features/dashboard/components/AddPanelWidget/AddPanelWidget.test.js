import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { AddPanelWidget } from './AddPanelWidget';
var setup = function (propOverrides) {
    var props = {
        dashboard: {},
        panel: {},
    };
    Object.assign(props, propOverrides);
    return shallow(React.createElement(AddPanelWidget, tslib_1.__assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=AddPanelWidget.test.js.map
import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import BasicSettings from './BasicSettings';
var setup = function () {
    var props = {
        dataSourceName: 'Graphite',
        isDefault: false,
        onDefaultChange: jest.fn(),
        onNameChange: jest.fn(),
    };
    return shallow(React.createElement(BasicSettings, tslib_1.__assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=BasicSettings.test.js.map
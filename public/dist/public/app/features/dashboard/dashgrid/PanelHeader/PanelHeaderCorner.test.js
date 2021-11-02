import React from 'react';
import { shallow } from 'enzyme';
import { PanelHeaderCorner } from './PanelHeaderCorner';
import { PanelModel } from '../../state';
describe('Render', function () {
    it('should render component', function () {
        var panel = new PanelModel({});
        var wrapper = shallow(React.createElement(PanelHeaderCorner, { panel: panel }));
        var instance = wrapper.instance();
        expect(instance.getInfoContent()).toBeDefined();
    });
});
//# sourceMappingURL=PanelHeaderCorner.test.js.map
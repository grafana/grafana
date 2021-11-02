import React from 'react';
import { mount } from 'enzyme';
import { ExploreDrawer } from './ExploreDrawer';
describe('<ExploreDrawer />', function () {
    it('renders child element', function () {
        var childElement = React.createElement("div", null, "Child element");
        var wrapper = mount(React.createElement(ExploreDrawer, { width: 400 }, childElement));
        expect(wrapper.text()).toBe('Child element');
    });
});
//# sourceMappingURL=ExploreDrawer.test.js.map
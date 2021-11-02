import React from 'react';
import { shallow, render } from 'enzyme';
import { MetaInfoText } from './MetaInfoText';
describe('MetaInfoText', function () {
    it('should render component', function () {
        var items = [
            { label: 'label', value: 'value' },
            { label: 'label2', value: 'value2' },
        ];
        var wrapper = shallow(React.createElement(MetaInfoText, { metaItems: items }));
        expect(wrapper).toMatchSnapshot();
    });
    it('should render items', function () {
        var items = [
            { label: 'label', value: 'value' },
            { label: 'label2', value: 'value2' },
        ];
        var wrapper = render(React.createElement(MetaInfoText, { metaItems: items }));
        expect(wrapper.find('label')).toBeTruthy();
        expect(wrapper.find('value')).toBeTruthy();
        expect(wrapper.find('label2')).toBeTruthy();
        expect(wrapper.find('value2')).toBeTruthy();
    });
    it('should render no items when the array is empty', function () {
        var items = [];
        var wrapper = shallow(React.createElement(MetaInfoText, { metaItems: items }));
        expect(wrapper.find('div').exists()).toBeTruthy();
        expect(wrapper.find('div').children()).toHaveLength(0);
    });
});
//# sourceMappingURL=MetaInfoText.test.js.map
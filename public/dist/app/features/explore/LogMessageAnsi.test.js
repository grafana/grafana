import React from 'react';
import { shallow } from 'enzyme';
import { LogMessageAnsi } from './LogMessageAnsi';
describe('<LogMessageAnsi />', function () {
    it('renders string without ANSI codes', function () {
        var wrapper = shallow(React.createElement(LogMessageAnsi, { value: "Lorem ipsum" }));
        expect(wrapper.find('span').exists()).toBe(false);
        expect(wrapper.text()).toBe('Lorem ipsum');
    });
    it('renders string with ANSI codes', function () {
        var value = 'Lorem \u001B[31mipsum\u001B[0m et dolor';
        var wrapper = shallow(React.createElement(LogMessageAnsi, { value: value }));
        expect(wrapper.find('span')).toHaveLength(1);
        expect(wrapper
            .find('span')
            .first()
            .prop('style')).toMatchObject(expect.objectContaining({
            color: expect.any(String),
        }));
        expect(wrapper
            .find('span')
            .first()
            .text()).toBe('ipsum');
    });
});
//# sourceMappingURL=LogMessageAnsi.test.js.map
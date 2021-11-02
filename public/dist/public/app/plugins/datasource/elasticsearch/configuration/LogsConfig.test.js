import React from 'react';
import { mount, shallow } from 'enzyme';
import { LogsConfig } from './LogsConfig';
import { createDefaultConfigOptions } from './mocks';
import { LegacyForms } from '@grafana/ui';
var FormField = LegacyForms.FormField;
describe('ElasticDetails', function () {
    it('should render without error', function () {
        mount(React.createElement(LogsConfig, { onChange: function () { }, value: createDefaultConfigOptions().jsonData }));
    });
    it('should render fields', function () {
        var wrapper = shallow(React.createElement(LogsConfig, { onChange: function () { }, value: createDefaultConfigOptions().jsonData }));
        expect(wrapper.find(FormField).length).toBe(2);
    });
    it('should pass correct data to onChange', function () {
        var onChangeMock = jest.fn();
        var wrapper = mount(React.createElement(LogsConfig, { onChange: onChangeMock, value: createDefaultConfigOptions().jsonData }));
        var inputEl = wrapper.find(FormField).at(0).find('input');
        inputEl.getDOMNode().value = 'test_field';
        inputEl.simulate('change');
        expect(onChangeMock.mock.calls[0][0].logMessageField).toBe('test_field');
    });
});
//# sourceMappingURL=LogsConfig.test.js.map
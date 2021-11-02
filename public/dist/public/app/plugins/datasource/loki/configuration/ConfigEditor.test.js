import React from 'react';
import { mount } from 'enzyme';
import { ConfigEditor } from './ConfigEditor';
import { createDefaultConfigOptions } from '../mocks';
import { DataSourceHttpSettings } from '@grafana/ui';
import { DerivedFields } from './DerivedFields';
describe('ConfigEditor', function () {
    it('should render without error', function () {
        mount(React.createElement(ConfigEditor, { onOptionsChange: function () { }, options: createDefaultConfigOptions() }));
    });
    it('should render the right sections', function () {
        var wrapper = mount(React.createElement(ConfigEditor, { onOptionsChange: function () { }, options: createDefaultConfigOptions() }));
        expect(wrapper.find(DataSourceHttpSettings).length).toBe(1);
        expect(wrapper.find({ label: 'Maximum lines' }).length).toBe(1);
        expect(wrapper.find(DerivedFields).length).toBe(1);
    });
    it('should pass correct data to onChange', function () {
        var onChangeMock = jest.fn();
        var wrapper = mount(React.createElement(ConfigEditor, { onOptionsChange: onChangeMock, options: createDefaultConfigOptions() }));
        var inputWrapper = wrapper.find({ label: 'Maximum lines' }).find('input');
        inputWrapper.getDOMNode().value = 42;
        inputWrapper.simulate('change');
        expect(onChangeMock.mock.calls[0][0].jsonData.maxLines).toBe('42');
    });
});
//# sourceMappingURL=ConfigEditor.test.js.map
import React from 'react';
import { mount, shallow } from 'enzyme';
import { ConfigEditor } from './ConfigEditor';
import { DataSourceHttpSettings } from '@grafana/ui';
import { ElasticDetails } from './ElasticDetails';
import { LogsConfig } from './LogsConfig';
import { createDefaultConfigOptions } from './mocks';
describe('ConfigEditor', function () {
    it('should render without error', function () {
        mount(React.createElement(ConfigEditor, { onOptionsChange: function () { }, options: createDefaultConfigOptions() }));
    });
    it('should render all parts of the config', function () {
        var wrapper = shallow(React.createElement(ConfigEditor, { onOptionsChange: function () { }, options: createDefaultConfigOptions() }));
        expect(wrapper.find(DataSourceHttpSettings).length).toBe(1);
        expect(wrapper.find(ElasticDetails).length).toBe(1);
        expect(wrapper.find(LogsConfig).length).toBe(1);
    });
    it('should set defaults', function () {
        var options = createDefaultConfigOptions();
        // @ts-ignore
        delete options.jsonData.esVersion;
        // @ts-ignore
        delete options.jsonData.timeField;
        delete options.jsonData.maxConcurrentShardRequests;
        expect.assertions(3);
        mount(React.createElement(ConfigEditor, { onOptionsChange: function (options) {
                expect(options.jsonData.esVersion).toBe('5.0.0');
                expect(options.jsonData.timeField).toBe('@timestamp');
                expect(options.jsonData.maxConcurrentShardRequests).toBe(256);
            }, options: options }));
    });
    it('should not apply default if values are set', function () {
        var onChange = jest.fn();
        mount(React.createElement(ConfigEditor, { onOptionsChange: onChange, options: createDefaultConfigOptions() }));
        expect(onChange).toHaveBeenCalledTimes(0);
    });
});
//# sourceMappingURL=ConfigEditor.test.js.map
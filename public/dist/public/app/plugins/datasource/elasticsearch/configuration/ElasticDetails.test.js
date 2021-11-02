import { __assign } from "tslib";
import React from 'react';
import { last } from 'lodash';
import { mount } from 'enzyme';
import { ElasticDetails } from './ElasticDetails';
import { createDefaultConfigOptions } from './mocks';
import { LegacyForms } from '@grafana/ui';
var Select = LegacyForms.Select;
describe('ElasticDetails', function () {
    it('should render without error', function () {
        mount(React.createElement(ElasticDetails, { onChange: function () { }, value: createDefaultConfigOptions() }));
    });
    it('should render "Max concurrent Shard Requests" if version high enough', function () {
        var wrapper = mount(React.createElement(ElasticDetails, { onChange: function () { }, value: createDefaultConfigOptions() }));
        expect(wrapper.find('input[aria-label="Max concurrent Shard Requests input"]').length).toBe(1);
    });
    it('should not render "Max concurrent Shard Requests" if version is low', function () {
        var options = createDefaultConfigOptions();
        options.jsonData.esVersion = '5.0.0';
        var wrapper = mount(React.createElement(ElasticDetails, { onChange: function () { }, value: options }));
        expect(wrapper.find('input[aria-label="Max concurrent Shard Requests input"]').length).toBe(0);
    });
    it('should change database on interval change when not set explicitly', function () {
        var onChangeMock = jest.fn();
        var wrapper = mount(React.createElement(ElasticDetails, { onChange: onChangeMock, value: createDefaultConfigOptions() }));
        var selectEl = wrapper.find({ label: 'Pattern' }).find(Select);
        selectEl.props().onChange({ value: 'Daily', label: 'Daily' });
        expect(onChangeMock.mock.calls[0][0].jsonData.interval).toBe('Daily');
        expect(onChangeMock.mock.calls[0][0].database).toBe('[logstash-]YYYY.MM.DD');
    });
    it('should change database on interval change if pattern is from example', function () {
        var onChangeMock = jest.fn();
        var options = createDefaultConfigOptions();
        options.database = '[logstash-]YYYY.MM.DD.HH';
        var wrapper = mount(React.createElement(ElasticDetails, { onChange: onChangeMock, value: options }));
        var selectEl = wrapper.find({ label: 'Pattern' }).find(Select);
        selectEl.props().onChange({ value: 'Monthly', label: 'Monthly' });
        expect(onChangeMock.mock.calls[0][0].jsonData.interval).toBe('Monthly');
        expect(onChangeMock.mock.calls[0][0].database).toBe('[logstash-]YYYY.MM');
    });
    describe('version change', function () {
        var testCases = [
            { version: '5.0.0', expectedMaxConcurrentShardRequests: 256 },
            { version: '5.0.0', maxConcurrentShardRequests: 50, expectedMaxConcurrentShardRequests: 50 },
            { version: '5.6.0', expectedMaxConcurrentShardRequests: 256 },
            { version: '5.6.0', maxConcurrentShardRequests: 256, expectedMaxConcurrentShardRequests: 256 },
            { version: '5.6.0', maxConcurrentShardRequests: 5, expectedMaxConcurrentShardRequests: 256 },
            { version: '5.6.0', maxConcurrentShardRequests: 200, expectedMaxConcurrentShardRequests: 200 },
            { version: '7.0.0', expectedMaxConcurrentShardRequests: 5 },
            { version: '7.0.0', maxConcurrentShardRequests: 256, expectedMaxConcurrentShardRequests: 5 },
            { version: '7.0.0', maxConcurrentShardRequests: 5, expectedMaxConcurrentShardRequests: 5 },
            { version: '7.0.0', maxConcurrentShardRequests: 6, expectedMaxConcurrentShardRequests: 6 },
        ];
        var onChangeMock = jest.fn();
        var options = createDefaultConfigOptions();
        var wrapper = mount(React.createElement(ElasticDetails, { onChange: onChangeMock, value: options }));
        testCases.forEach(function (tc) {
            it("sets maxConcurrentShardRequests = " + tc.maxConcurrentShardRequests + " if version = " + tc.version + ",", function () {
                wrapper.setProps({
                    onChange: onChangeMock,
                    value: __assign(__assign({}, options), { jsonData: __assign(__assign({}, options.jsonData), { maxConcurrentShardRequests: tc.maxConcurrentShardRequests }) }),
                });
                var selectEl = wrapper.find({ label: 'Version' }).find(Select);
                selectEl.props().onChange({ value: tc.version, label: tc.version.toString() });
                expect(last(onChangeMock.mock.calls)[0].jsonData.maxConcurrentShardRequests).toBe(tc.expectedMaxConcurrentShardRequests);
            });
        });
    });
});
//# sourceMappingURL=ElasticDetails.test.js.map
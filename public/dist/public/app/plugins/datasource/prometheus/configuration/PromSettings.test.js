import { __makeTemplateObject } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import { EventsWithValidation } from '@grafana/ui';
import { getValueFromEventItem, promSettingsValidationEvents, PromSettings } from './PromSettings';
import { createDefaultConfigOptions } from './mocks';
describe('PromSettings', function () {
    describe('getValueFromEventItem', function () {
        describe('when called with undefined', function () {
            it('then it should return empty string', function () {
                var result = getValueFromEventItem(undefined);
                expect(result).toEqual('');
            });
        });
        describe('when called with an input event', function () {
            it('then it should return value from currentTarget', function () {
                var value = 'An input value';
                var result = getValueFromEventItem({ currentTarget: { value: value } });
                expect(result).toEqual(value);
            });
        });
        describe('when called with a select event', function () {
            it('then it should return value', function () {
                var value = 'A select value';
                var result = getValueFromEventItem({ value: value });
                expect(result).toEqual(value);
            });
        });
    });
    describe('promSettingsValidationEvents', function () {
        var validationEvents = promSettingsValidationEvents;
        it('should have one event handlers', function () {
            expect(Object.keys(validationEvents).length).toEqual(1);
        });
        it('should have an onBlur handler', function () {
            expect(validationEvents.hasOwnProperty(EventsWithValidation.onBlur)).toBe(true);
        });
        it('should have one rule', function () {
            expect(validationEvents[EventsWithValidation.onBlur].length).toEqual(1);
        });
        describe('when calling the rule with an empty string', function () {
            it('then it should return true', function () {
                expect(validationEvents[EventsWithValidation.onBlur][0].rule('')).toBe(true);
            });
        });
        it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      value    | expected\n      ", " | ", "\n      ", "  | ", "\n      ", "  | ", "\n      ", "  | ", "\n      ", "  | ", "\n      ", "  | ", "\n      ", "  | ", "\n      ", "  | ", "\n    "], ["\n      value    | expected\n      ", " | ", "\n      ", "  | ", "\n      ", "  | ", "\n      ", "  | ", "\n      ", "  | ", "\n      ", "  | ", "\n      ", "  | ", "\n      ", "  | ", "\n    "])), '1ms', true, '1M', true, '1w', true, '1d', true, '1h', true, '1m', true, '1s', true, '1y', true)("when calling the rule with correct formatted value: '$value' then result should be '$expected'", function (_a) {
            var value = _a.value, expected = _a.expected;
            expect(validationEvents[EventsWithValidation.onBlur][0].rule(value)).toBe(expected);
        });
        it.each(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      value     | expected\n      ", " | ", "\n      ", "   | ", "\n      ", "    | ", "\n      ", "    | ", "\n      ", " | ", "\n    "], ["\n      value     | expected\n      ", " | ", "\n      ", "   | ", "\n      ", "    | ", "\n      ", "    | ", "\n      ", " | ", "\n    "])), '1 ms', false, '1x', false, ' ', false, 'w', false, '1.0s', false)("when calling the rule with incorrect formatted value: '$value' then result should be '$expected'", function (_a) {
            var value = _a.value, expected = _a.expected;
            expect(validationEvents[EventsWithValidation.onBlur][0].rule(value)).toBe(expected);
        });
    });
    describe('PromSettings component', function () {
        var defaultProps = createDefaultConfigOptions();
        it('should show POST httpMethod if no httpMethod', function () {
            var options = defaultProps;
            options.url = '';
            options.jsonData.httpMethod = '';
            render(React.createElement("div", null,
                React.createElement(PromSettings, { onOptionsChange: function () { }, options: options })));
            expect(screen.getByText('POST')).toBeInTheDocument();
        });
        it('should show POST httpMethod if POST httpMethod is configured', function () {
            var options = defaultProps;
            options.url = 'test_url';
            options.jsonData.httpMethod = 'POST';
            render(React.createElement("div", null,
                React.createElement(PromSettings, { onOptionsChange: function () { }, options: options })));
            expect(screen.getByText('POST')).toBeInTheDocument();
        });
        it('should show GET httpMethod if GET httpMethod is configured', function () {
            var options = defaultProps;
            options.url = 'test_url';
            options.jsonData.httpMethod = 'GET';
            render(React.createElement("div", null,
                React.createElement(PromSettings, { onOptionsChange: function () { }, options: options })));
            expect(screen.getByText('GET')).toBeInTheDocument();
        });
    });
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=PromSettings.test.js.map
import { __awaiter, __generator } from "tslib";
import React from 'react';
import { mount } from 'enzyme';
import { DerivedFields } from './DerivedFields';
import { Button } from '@grafana/ui';
import { DerivedField } from './DerivedField';
import { act } from 'react-dom/test-utils';
describe('DerivedFields', function () {
    var originalGetSelection;
    beforeAll(function () {
        originalGetSelection = window.getSelection;
        window.getSelection = function () { return null; };
    });
    afterAll(function () {
        window.getSelection = originalGetSelection;
    });
    it('renders correctly when no fields', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                //@ts-ignore
                return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, mount(React.createElement(DerivedFields, { onChange: function () { } }))];
                                case 1:
                                    wrapper = _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    //@ts-ignore
                    _a.sent();
                    expect(wrapper.find(Button).length).toBe(1);
                    expect(wrapper.find(Button).contains('Add')).toBeTruthy();
                    expect(wrapper.find(DerivedField).length).toBe(0);
                    return [2 /*return*/];
            }
        });
    }); });
    it('renders correctly when there are fields', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                //@ts-ignore
                return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, mount(React.createElement(DerivedFields, { value: testValue, onChange: function () { } }))];
                                case 1:
                                    wrapper = _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    //@ts-ignore
                    _a.sent();
                    expect(wrapper.find(Button).filterWhere(function (button) { return button.contains('Add'); }).length).toBe(1);
                    expect(wrapper.find(Button).filterWhere(function (button) { return button.contains('Show example log message'); }).length).toBe(1);
                    expect(wrapper
                        .find(Button)
                        .filterWhere(function (button) { return button.contains('Show example log message'); })
                        .getDOMNode()).toHaveAttribute('type', 'button');
                    expect(wrapper.find(DerivedField).length).toBe(2);
                    return [2 /*return*/];
            }
        });
    }); });
    it('adds new field', function () { return __awaiter(void 0, void 0, void 0, function () {
        var onChangeMock, wrapper, addButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    onChangeMock = jest.fn();
                    //@ts-ignore
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, mount(React.createElement(DerivedFields, { onChange: onChangeMock }))];
                                    case 1:
                                        wrapper = _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    //@ts-ignore
                    _a.sent();
                    addButton = wrapper.find(Button).filterWhere(function (button) { return button.contains('Add'); });
                    addButton.simulate('click');
                    expect(onChangeMock.mock.calls[0][0].length).toBe(1);
                    return [2 /*return*/];
            }
        });
    }); });
    it('removes field', function () { return __awaiter(void 0, void 0, void 0, function () {
        var onChangeMock, wrapper, removeButton, newValue;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    onChangeMock = jest.fn();
                    //@ts-ignore
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, mount(React.createElement(DerivedFields, { value: testValue, onChange: onChangeMock }))];
                                    case 1:
                                        wrapper = _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    //@ts-ignore
                    _a.sent();
                    removeButton = wrapper.find(DerivedField).at(0).find(Button);
                    removeButton.simulate('click');
                    newValue = onChangeMock.mock.calls[0][0];
                    expect(newValue.length).toBe(1);
                    expect(newValue[0]).toMatchObject({
                        matcherRegex: 'regex2',
                        name: 'test2',
                        url: 'localhost2',
                    });
                    return [2 /*return*/];
            }
        });
    }); });
});
var testValue = [
    {
        matcherRegex: 'regex1',
        name: 'test1',
        url: 'localhost1',
    },
    {
        matcherRegex: 'regex2',
        name: 'test2',
        url: 'localhost2',
    },
];
//# sourceMappingURL=DerivedFields.test.js.map
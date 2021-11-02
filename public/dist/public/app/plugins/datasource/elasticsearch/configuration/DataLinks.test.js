import { __awaiter, __generator } from "tslib";
import React from 'react';
import { mount } from 'enzyme';
import { DataLinks } from './DataLinks';
import { Button } from '@grafana/ui';
import { DataLink } from './DataLink';
import { act } from 'react-dom/test-utils';
describe('DataLinks', function () {
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
                case 0: return [4 /*yield*/, act(
                    // @ts-ignore we shouldn't use Promises in act => the "void | undefined" is here to forbid any sneaky "Promise" returns.
                    function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, mount(React.createElement(DataLinks, { onChange: function () { } }))];
                                case 1:
                                    wrapper = _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    _a.sent();
                    expect(wrapper.find(Button).length).toBe(1);
                    expect(wrapper.find(Button).contains('Add')).toBeTruthy();
                    expect(wrapper.find(DataLink).length).toBe(0);
                    return [2 /*return*/];
            }
        });
    }); });
    it('renders correctly when there are fields', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, act(
                    // @ts-ignore we shouldn't use Promises in act => the "void | undefined" is here to forbid any sneaky "Promise" returns.
                    function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, mount(React.createElement(DataLinks, { value: testValue, onChange: function () { } }))];
                                case 1:
                                    wrapper = _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    _a.sent();
                    expect(wrapper.find(Button).filterWhere(function (button) { return button.contains('Add'); }).length).toBe(1);
                    expect(wrapper.find(DataLink).length).toBe(2);
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
                    return [4 /*yield*/, act(
                        // @ts-ignore we shouldn't use Promises in act => the "void | undefined" is here to forbid any sneaky "Promise" returns.
                        function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, mount(React.createElement(DataLinks, { onChange: onChangeMock }))];
                                    case 1:
                                        wrapper = _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
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
                    return [4 /*yield*/, act(
                        // @ts-ignore we shouldn't use Promises in act => the "void | undefined" is here to forbid any sneaky "Promise" returns.
                        function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, mount(React.createElement(DataLinks, { value: testValue, onChange: onChangeMock }))];
                                    case 1:
                                        wrapper = _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    removeButton = wrapper.find(DataLink).at(0).find(Button);
                    removeButton.simulate('click');
                    newValue = onChangeMock.mock.calls[0][0];
                    expect(newValue.length).toBe(1);
                    expect(newValue[0]).toMatchObject({
                        field: 'regex2',
                        url: 'localhost2',
                    });
                    return [2 /*return*/];
            }
        });
    }); });
});
var testValue = [
    {
        field: 'regex1',
        url: 'localhost1',
    },
    {
        field: 'regex2',
        url: 'localhost2',
    },
];
//# sourceMappingURL=DataLinks.test.js.map
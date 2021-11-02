import { __awaiter, __generator } from "tslib";
import React from 'react';
import { QueryOperationRow } from './QueryOperationRow';
import { mount, shallow } from 'enzyme';
import { act } from 'react-dom/test-utils';
describe('QueryOperationRow', function () {
    it('renders', function () {
        expect(function () {
            return shallow(React.createElement(QueryOperationRow, { id: "test-id", index: 0 },
                React.createElement("div", null, "Test")));
        }).not.toThrow();
    });
    describe('callbacks', function () {
        it('should not call onOpen when component is shallowed', function () { return __awaiter(void 0, void 0, void 0, function () {
            var onOpenSpy;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        onOpenSpy = jest.fn();
                        // @ts-ignore strict null error, you shouldn't use promise like approach with act but I don't know what the intention is here
                        return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    shallow(React.createElement(QueryOperationRow, { onOpen: onOpenSpy, id: "test-id", index: 0 },
                                        React.createElement("div", null, "Test")));
                                    return [2 /*return*/];
                                });
                            }); })];
                    case 1:
                        // @ts-ignore strict null error, you shouldn't use promise like approach with act but I don't know what the intention is here
                        _a.sent();
                        expect(onOpenSpy).not.toBeCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should call onOpen when row is opened and onClose when row is collapsed', function () { return __awaiter(void 0, void 0, void 0, function () {
            var onOpenSpy, onCloseSpy, wrapper, titleEl;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        onOpenSpy = jest.fn();
                        onCloseSpy = jest.fn();
                        wrapper = mount(React.createElement(QueryOperationRow, { title: "title", onOpen: onOpenSpy, onClose: onCloseSpy, isOpen: false, id: "test-id", index: 0 },
                            React.createElement("div", null, "Test")));
                        titleEl = wrapper.find({ 'aria-label': 'Query operation row title' });
                        expect(titleEl).toHaveLength(1);
                        // @ts-ignore strict null error, you shouldn't use promise like approach with act but I don't know what the intention is here
                        return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    // open
                                    titleEl.first().simulate('click');
                                    return [2 /*return*/];
                                });
                            }); })];
                    case 1:
                        // @ts-ignore strict null error, you shouldn't use promise like approach with act but I don't know what the intention is here
                        _a.sent();
                        // @ts-ignore strict null error, you shouldn't use promise like approach with act but I don't know what the intention is here
                        return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    // close
                                    titleEl.first().simulate('click');
                                    return [2 /*return*/];
                                });
                            }); })];
                    case 2:
                        // @ts-ignore strict null error, you shouldn't use promise like approach with act but I don't know what the intention is here
                        _a.sent();
                        expect(onOpenSpy).toBeCalledTimes(1);
                        expect(onCloseSpy).toBeCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('headerElement rendering', function () {
        it('should render headerElement provided as element', function () {
            var title = React.createElement("div", { "aria-label": "test title" }, "Test");
            var wrapper = shallow(React.createElement(QueryOperationRow, { headerElement: title, id: "test-id", index: 0 },
                React.createElement("div", null, "Test")));
            var titleEl = wrapper.find({ 'aria-label': 'test title' });
            expect(titleEl).toHaveLength(1);
        });
        it('should render headerElement provided as function', function () {
            var title = function () { return React.createElement("div", { "aria-label": "test title" }, "Test"); };
            var wrapper = shallow(React.createElement(QueryOperationRow, { headerElement: title, id: "test-id", index: 0 },
                React.createElement("div", null, "Test")));
            var titleEl = wrapper.find({ 'aria-label': 'test title' });
            expect(titleEl).toHaveLength(1);
        });
        it('should expose api to headerElement rendered as function', function () {
            var propsSpy = jest.fn();
            var title = function (props) {
                propsSpy(props);
                return React.createElement("div", { "aria-label": "test title" }, "Test");
            };
            shallow(React.createElement(QueryOperationRow, { headerElement: title, id: "test-id", index: 0 },
                React.createElement("div", null, "Test")));
            expect(Object.keys(propsSpy.mock.calls[0][0])).toContain('isOpen');
        });
    });
    describe('actions rendering', function () {
        it('should render actions provided as element', function () {
            var actions = React.createElement("div", { "aria-label": "test actions" }, "Test");
            var wrapper = shallow(React.createElement(QueryOperationRow, { actions: actions, id: "test-id", index: 0 },
                React.createElement("div", null, "Test")));
            var actionsEl = wrapper.find({ 'aria-label': 'test actions' });
            expect(actionsEl).toHaveLength(1);
        });
        it('should render actions provided as function', function () {
            var actions = function () { return React.createElement("div", { "aria-label": "test actions" }, "Test"); };
            var wrapper = shallow(React.createElement(QueryOperationRow, { actions: actions, id: "test-id", index: 0 },
                React.createElement("div", null, "Test")));
            var actionsEl = wrapper.find({ 'aria-label': 'test actions' });
            expect(actionsEl).toHaveLength(1);
        });
        it('should expose api to title rendered as function', function () {
            var propsSpy = jest.fn();
            var actions = function (props) {
                propsSpy(props);
                return React.createElement("div", { "aria-label": "test actions" }, "Test");
            };
            shallow(React.createElement(QueryOperationRow, { actions: actions, id: "test-id", index: 0 },
                React.createElement("div", null, "Test")));
            expect(Object.keys(propsSpy.mock.calls[0][0])).toEqual(['isOpen', 'onOpen', 'onClose']);
        });
    });
});
//# sourceMappingURL=QueryOperationRow.test.js.map
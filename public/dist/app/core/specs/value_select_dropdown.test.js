var _this = this;
import * as tslib_1 from "tslib";
import 'app/core/directives/value_select_dropdown';
import { ValueSelectDropdownCtrl } from '../directives/value_select_dropdown';
import q from 'q';
describe('SelectDropdownCtrl', function () {
    var tagValuesMap = {};
    ValueSelectDropdownCtrl.prototype.onUpdated = jest.fn();
    var ctrl;
    describe('Given simple variable', function () {
        beforeEach(function () {
            ctrl = new ValueSelectDropdownCtrl(q);
            ctrl.variable = {
                current: { text: 'hej', value: 'hej' },
                getValuesForTag: function (key) {
                    return Promise.resolve(tagValuesMap[key]);
                },
            };
            ctrl.init();
        });
        it('Should init labelText and linkText', function () {
            expect(ctrl.linkText).toBe('hej');
        });
    });
    describe('Given variable with tags and dropdown is opened', function () {
        beforeEach(function () {
            ctrl = new ValueSelectDropdownCtrl(q);
            ctrl.variable = {
                current: { text: 'server-1', value: 'server-1' },
                options: [
                    { text: 'server-1', value: 'server-1', selected: true },
                    { text: 'server-2', value: 'server-2' },
                    { text: 'server-3', value: 'server-3' },
                ],
                tags: ['key1', 'key2', 'key3'],
                getValuesForTag: function (key) {
                    return Promise.resolve(tagValuesMap[key]);
                },
                multi: true,
            };
            tagValuesMap.key1 = ['server-1', 'server-3'];
            tagValuesMap.key2 = ['server-2', 'server-3'];
            tagValuesMap.key3 = ['server-1', 'server-2', 'server-3'];
            ctrl.init();
            ctrl.show();
        });
        it('should init tags model', function () {
            expect(ctrl.tags.length).toBe(3);
            expect(ctrl.tags[0].text).toBe('key1');
        });
        it('should init options model', function () {
            expect(ctrl.options.length).toBe(3);
        });
        it('should init selected values array', function () {
            expect(ctrl.selectedValues.length).toBe(1);
        });
        it('should set linkText', function () {
            expect(ctrl.linkText).toBe('server-1');
        });
        describe('after adititional value is selected', function () {
            beforeEach(function () {
                ctrl.selectValue(ctrl.options[2], {});
                ctrl.commitChanges();
            });
            it('should update link text', function () {
                expect(ctrl.linkText).toBe('server-1 + server-3');
            });
        });
        describe('When tag is selected', function () {
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctrl.selectTag(ctrl.tags[0])];
                        case 1:
                            _a.sent();
                            ctrl.commitChanges();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should select tag', function () {
                expect(ctrl.selectedTags.length).toBe(1);
            });
            it('should select values', function () {
                expect(ctrl.options[0].selected).toBe(true);
                expect(ctrl.options[2].selected).toBe(true);
            });
            it('link text should not include tag values', function () {
                expect(ctrl.linkText).toBe('');
            });
            describe('and then dropdown is opened and closed without changes', function () {
                beforeEach(function () {
                    ctrl.show();
                    ctrl.commitChanges();
                });
                it('should still have selected tag', function () {
                    expect(ctrl.selectedTags.length).toBe(1);
                });
            });
            describe('and then unselected', function () {
                beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                    return tslib_1.__generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, ctrl.selectTag(ctrl.tags[0])];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                it('should deselect tag', function () {
                    expect(ctrl.selectedTags.length).toBe(0);
                });
            });
            describe('and then value is unselected', function () {
                beforeEach(function () {
                    ctrl.selectValue(ctrl.options[0], {});
                });
                it('should deselect tag', function () {
                    expect(ctrl.selectedTags.length).toBe(0);
                });
            });
        });
    });
    describe('Given variable with selected tags', function () {
        beforeEach(function () {
            ctrl = new ValueSelectDropdownCtrl(q);
            ctrl.variable = {
                current: {
                    text: 'server-1',
                    value: 'server-1',
                    tags: [{ text: 'key1', selected: true }],
                },
                options: [
                    { text: 'server-1', value: 'server-1' },
                    { text: 'server-2', value: 'server-2' },
                    { text: 'server-3', value: 'server-3' },
                ],
                tags: ['key1', 'key2', 'key3'],
                getValuesForTag: function (key) {
                    return Promise.resolve(tagValuesMap[key]);
                },
                multi: true,
            };
            ctrl.init();
            ctrl.show();
        });
        it('should set tag as selected', function () {
            expect(ctrl.tags[0].selected).toBe(true);
        });
    });
});
//# sourceMappingURL=value_select_dropdown.test.js.map
import { __awaiter, __generator, __values } from "tslib";
import { debounce, trim } from 'lodash';
import { variableAdapters } from '../../adapters';
import { getVariable } from '../../state/selectors';
import { NavigationKey } from '../types';
import { hideOptions, moveOptionsHighlight, showOptions, toggleOption, updateOptionsAndFilter, updateOptionsFromSearch, updateSearchQuery, } from './reducer';
import { changeVariableProp, setCurrentVariableValue } from '../../state/sharedReducer';
import { toVariablePayload } from '../../state/types';
import { containsSearchFilter, getCurrentText } from '../../utils';
export var navigateOptions = function (key, clearOthers) {
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(key === NavigationKey.cancel)) return [3 /*break*/, 2];
                    return [4 /*yield*/, dispatch(commitChangesToVariable())];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    if (key === NavigationKey.select) {
                        return [2 /*return*/, dispatch(toggleOptionByHighlight(clearOthers))];
                    }
                    if (!(key === NavigationKey.selectAndClose)) return [3 /*break*/, 4];
                    dispatch(toggleOptionByHighlight(clearOthers, true));
                    return [4 /*yield*/, dispatch(commitChangesToVariable())];
                case 3: return [2 /*return*/, _a.sent()];
                case 4:
                    if (key === NavigationKey.moveDown) {
                        return [2 /*return*/, dispatch(moveOptionsHighlight(1))];
                    }
                    if (key === NavigationKey.moveUp) {
                        return [2 /*return*/, dispatch(moveOptionsHighlight(-1))];
                    }
                    return [2 /*return*/, undefined];
            }
        });
    }); };
};
export var filterOrSearchOptions = function (searchQuery) {
    if (searchQuery === void 0) { searchQuery = ''; }
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, id, queryValue, _b, query, options;
        return __generator(this, function (_c) {
            _a = getState().templating.optionsPicker, id = _a.id, queryValue = _a.queryValue;
            _b = getVariable(id, getState()), query = _b.query, options = _b.options;
            dispatch(updateSearchQuery(searchQuery));
            if (trim(queryValue) === trim(searchQuery)) {
                return [2 /*return*/];
            }
            if (containsSearchFilter(query)) {
                return [2 /*return*/, searchForOptionsWithDebounce(dispatch, getState, searchQuery)];
            }
            return [2 /*return*/, dispatch(updateOptionsAndFilter(options))];
        });
    }); };
};
var setVariable = function (updated) { return __awaiter(void 0, void 0, void 0, function () {
    var adapter;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                adapter = variableAdapters.get(updated.type);
                return [4 /*yield*/, adapter.setValue(updated, updated.current, true)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export var commitChangesToVariable = function (callback) {
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var picker, existing, currentPayload, searchQueryPayload, updated;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    picker = getState().templating.optionsPicker;
                    existing = getVariable(picker.id, getState());
                    currentPayload = { option: mapToCurrent(picker) };
                    searchQueryPayload = { propName: 'queryValue', propValue: picker.queryValue };
                    dispatch(setCurrentVariableValue(toVariablePayload(existing, currentPayload)));
                    dispatch(changeVariableProp(toVariablePayload(existing, searchQueryPayload)));
                    updated = getVariable(picker.id, getState());
                    dispatch(hideOptions());
                    if (getCurrentText(existing) === getCurrentText(updated)) {
                        return [2 /*return*/];
                    }
                    if (callback) {
                        return [2 /*return*/, callback(updated)];
                    }
                    return [4 /*yield*/, setVariable(updated)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
};
export var openOptions = function (_a, callback) {
    var id = _a.id;
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var picker, variable;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    picker = getState().templating.optionsPicker;
                    if (!(picker.id && picker.id !== id)) return [3 /*break*/, 2];
                    return [4 /*yield*/, dispatch(commitChangesToVariable(callback))];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    variable = getVariable(id, getState());
                    dispatch(showOptions(variable));
                    return [2 /*return*/];
            }
        });
    }); };
};
export var toggleOptionByHighlight = function (clearOthers, forceSelect) {
    if (forceSelect === void 0) { forceSelect = false; }
    return function (dispatch, getState) {
        var _a = getState().templating.optionsPicker, highlightIndex = _a.highlightIndex, options = _a.options;
        var option = options[highlightIndex];
        dispatch(toggleOption({ option: option, forceSelect: forceSelect, clearOthers: clearOthers }));
    };
};
var searchForOptions = function (dispatch, getState, searchQuery) { return __awaiter(void 0, void 0, void 0, function () {
    var id, existing, adapter, updated, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                id = getState().templating.optionsPicker.id;
                existing = getVariable(id, getState());
                adapter = variableAdapters.get(existing.type);
                return [4 /*yield*/, adapter.updateOptions(existing, searchQuery)];
            case 1:
                _a.sent();
                updated = getVariable(id, getState());
                dispatch(updateOptionsFromSearch(updated.options));
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                console.error(error_1);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var searchForOptionsWithDebounce = debounce(searchForOptions, 500);
export function mapToCurrent(picker) {
    var e_1, _a;
    var options = picker.options, selectedValues = picker.selectedValues, searchQuery = picker.queryValue, multi = picker.multi;
    if (options.length === 0 && searchQuery && searchQuery.length > 0) {
        return { text: searchQuery, value: searchQuery, selected: false };
    }
    if (!multi) {
        return selectedValues.find(function (o) { return o.selected; });
    }
    var texts = [];
    var values = [];
    try {
        for (var selectedValues_1 = __values(selectedValues), selectedValues_1_1 = selectedValues_1.next(); !selectedValues_1_1.done; selectedValues_1_1 = selectedValues_1.next()) {
            var option = selectedValues_1_1.value;
            if (!option.selected) {
                continue;
            }
            texts.push(option.text.toString());
            values.push(option.value.toString());
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (selectedValues_1_1 && !selectedValues_1_1.done && (_a = selectedValues_1.return)) _a.call(selectedValues_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return {
        value: values,
        text: texts,
        selected: true,
    };
}
//# sourceMappingURL=actions.js.map
import { __awaiter, __generator } from "tslib";
import { VariableSupportType } from '@grafana/data';
import { getVariableQueryEditor, StandardVariableQueryEditor } from './getVariableQueryEditor';
import { LegacyVariableQueryEditor } from './LegacyVariableQueryEditor';
describe('getVariableQueryEditor', function () {
    describe('happy cases', function () {
        describe('when called with a data source with custom variable support', function () {
            it('then it should return correct editor', function () { return __awaiter(void 0, void 0, void 0, function () {
                var editor, datasource, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            editor = StandardVariableQueryEditor;
                            datasource = {
                                variables: { getType: function () { return VariableSupportType.Custom; }, query: function () { return undefined; }, editor: editor },
                            };
                            return [4 /*yield*/, getVariableQueryEditor(datasource)];
                        case 1:
                            result = _a.sent();
                            expect(result).toBe(editor);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when called with a data source with standard variable support', function () {
            it('then it should return correct editor', function () { return __awaiter(void 0, void 0, void 0, function () {
                var editor, datasource, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            editor = StandardVariableQueryEditor;
                            datasource = {
                                variables: { getType: function () { return VariableSupportType.Standard; }, toDataQuery: function () { return undefined; } },
                            };
                            return [4 /*yield*/, getVariableQueryEditor(datasource)];
                        case 1:
                            result = _a.sent();
                            expect(result).toBe(editor);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when called with a data source with datasource variable support', function () {
            it('then it should return correct editor', function () { return __awaiter(void 0, void 0, void 0, function () {
                var editor, plugin, importDataSourcePluginFunc, datasource, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            editor = StandardVariableQueryEditor;
                            plugin = { components: { QueryEditor: editor } };
                            importDataSourcePluginFunc = jest.fn().mockResolvedValue(plugin);
                            datasource = { variables: { getType: function () { return VariableSupportType.Datasource; } }, meta: {} };
                            return [4 /*yield*/, getVariableQueryEditor(datasource, importDataSourcePluginFunc)];
                        case 1:
                            result = _a.sent();
                            expect(result).toBe(editor);
                            expect(importDataSourcePluginFunc).toHaveBeenCalledTimes(1);
                            expect(importDataSourcePluginFunc).toHaveBeenCalledWith({});
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when called with a data source with legacy variable support', function () {
            it('then it should return correct editor', function () { return __awaiter(void 0, void 0, void 0, function () {
                var editor, plugin, importDataSourcePluginFunc, datasource, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            editor = StandardVariableQueryEditor;
                            plugin = { components: { VariableQueryEditor: editor } };
                            importDataSourcePluginFunc = jest.fn().mockResolvedValue(plugin);
                            datasource = { metricFindQuery: function () { return undefined; }, meta: {} };
                            return [4 /*yield*/, getVariableQueryEditor(datasource, importDataSourcePluginFunc)];
                        case 1:
                            result = _a.sent();
                            expect(result).toBe(editor);
                            expect(importDataSourcePluginFunc).toHaveBeenCalledTimes(1);
                            expect(importDataSourcePluginFunc).toHaveBeenCalledWith({});
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('negative cases', function () {
        describe('when variable support is not recognized', function () {
            it('then it should return null', function () { return __awaiter(void 0, void 0, void 0, function () {
                var datasource, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            datasource = {};
                            return [4 /*yield*/, getVariableQueryEditor(datasource)];
                        case 1:
                            result = _a.sent();
                            expect(result).toBeNull();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when called with a data source with datasource variable support but missing QueryEditor', function () {
            it('then it should return throw', function () { return __awaiter(void 0, void 0, void 0, function () {
                var plugin, importDataSourcePluginFunc, datasource;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            plugin = { components: {} };
                            importDataSourcePluginFunc = jest.fn().mockResolvedValue(plugin);
                            datasource = { variables: { getType: function () { return VariableSupportType.Datasource; } }, meta: {} };
                            return [4 /*yield*/, expect(getVariableQueryEditor(datasource, importDataSourcePluginFunc)).rejects.toThrow(new Error('Missing QueryEditor in plugin definition.'))];
                        case 1:
                            _a.sent();
                            expect(importDataSourcePluginFunc).toHaveBeenCalledTimes(1);
                            expect(importDataSourcePluginFunc).toHaveBeenCalledWith({});
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when called with a data source with legacy variable support but missing VariableQueryEditor', function () {
            it('then it should return LegacyVariableQueryEditor', function () { return __awaiter(void 0, void 0, void 0, function () {
                var plugin, importDataSourcePluginFunc, datasource, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            plugin = { components: {} };
                            importDataSourcePluginFunc = jest.fn().mockResolvedValue(plugin);
                            datasource = { metricFindQuery: function () { return undefined; }, meta: {} };
                            return [4 /*yield*/, getVariableQueryEditor(datasource, importDataSourcePluginFunc)];
                        case 1:
                            result = _a.sent();
                            expect(result).toBe(LegacyVariableQueryEditor);
                            expect(importDataSourcePluginFunc).toHaveBeenCalledTimes(1);
                            expect(importDataSourcePluginFunc).toHaveBeenCalledWith({});
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
});
//# sourceMappingURL=getVariableQueryEditor.test.js.map
import { __awaiter } from "tslib";
import { VariableSupportType } from '@grafana/data';
import { LegacyVariableQueryEditor } from './LegacyVariableQueryEditor';
import { getVariableQueryEditor, StandardVariableQueryEditor } from './getVariableQueryEditor';
describe('getVariableQueryEditor', () => {
    describe('happy cases', () => {
        describe('when called with a data source with custom variable support', () => {
            it('then it should return correct editor', () => __awaiter(void 0, void 0, void 0, function* () {
                const editor = StandardVariableQueryEditor;
                const datasource = {
                    variables: { getType: () => VariableSupportType.Custom, query: jest.fn(), editor },
                };
                const result = yield getVariableQueryEditor(datasource);
                expect(result).toBe(editor);
            }));
        });
        describe('when called with a data source with standard variable support', () => {
            it('then it should return correct editor', () => __awaiter(void 0, void 0, void 0, function* () {
                const editor = StandardVariableQueryEditor;
                const datasource = {
                    variables: { getType: () => VariableSupportType.Standard, toDataQuery: jest.fn() },
                };
                const result = yield getVariableQueryEditor(datasource);
                expect(result).toBe(editor);
            }));
        });
        describe('when called with a data source with datasource variable support', () => {
            it('then it should return correct editor', () => __awaiter(void 0, void 0, void 0, function* () {
                const editor = StandardVariableQueryEditor;
                const plugin = { components: { QueryEditor: editor } };
                const importDataSourcePluginFunc = jest.fn().mockResolvedValue(plugin);
                const datasource = {
                    variables: { getType: () => VariableSupportType.Datasource },
                    meta: {},
                };
                const result = yield getVariableQueryEditor(datasource, importDataSourcePluginFunc);
                expect(result).toBe(editor);
                expect(importDataSourcePluginFunc).toHaveBeenCalledTimes(1);
                expect(importDataSourcePluginFunc).toHaveBeenCalledWith({});
            }));
        });
        describe('when called with a data source with legacy variable support', () => {
            it('then it should return correct editor', () => __awaiter(void 0, void 0, void 0, function* () {
                const editor = StandardVariableQueryEditor;
                const plugin = { components: { VariableQueryEditor: editor } };
                const importDataSourcePluginFunc = jest.fn().mockResolvedValue(plugin);
                const datasource = { metricFindQuery: () => undefined, meta: {} };
                const result = yield getVariableQueryEditor(datasource, importDataSourcePluginFunc);
                expect(result).toBe(editor);
                expect(importDataSourcePluginFunc).toHaveBeenCalledTimes(1);
                expect(importDataSourcePluginFunc).toHaveBeenCalledWith({});
            }));
        });
    });
    describe('negative cases', () => {
        describe('when variable support is not recognized', () => {
            it('then it should return null', () => __awaiter(void 0, void 0, void 0, function* () {
                const datasource = {};
                const result = yield getVariableQueryEditor(datasource);
                expect(result).toBeNull();
            }));
        });
        describe('when called with a data source with datasource variable support but missing QueryEditor', () => {
            it('then it should return throw', () => __awaiter(void 0, void 0, void 0, function* () {
                const plugin = { components: {} };
                const importDataSourcePluginFunc = jest.fn().mockResolvedValue(plugin);
                const datasource = {
                    variables: { getType: () => VariableSupportType.Datasource },
                    meta: {},
                };
                yield expect(getVariableQueryEditor(datasource, importDataSourcePluginFunc)).rejects.toThrow(new Error('Missing QueryEditor in plugin definition.'));
                expect(importDataSourcePluginFunc).toHaveBeenCalledTimes(1);
                expect(importDataSourcePluginFunc).toHaveBeenCalledWith({});
            }));
        });
        describe('when called with a data source with legacy variable support but missing VariableQueryEditor', () => {
            it('then it should return LegacyVariableQueryEditor', () => __awaiter(void 0, void 0, void 0, function* () {
                const plugin = { components: {} };
                const importDataSourcePluginFunc = jest.fn().mockResolvedValue(plugin);
                const datasource = { metricFindQuery: () => undefined, meta: {} };
                const result = yield getVariableQueryEditor(datasource, importDataSourcePluginFunc);
                expect(result).toBe(LegacyVariableQueryEditor);
                expect(importDataSourcePluginFunc).toHaveBeenCalledTimes(1);
                expect(importDataSourcePluginFunc).toHaveBeenCalledWith({});
            }));
        });
    });
});
//# sourceMappingURL=getVariableQueryEditor.test.js.map
import { DataSourceApi, VariableSupportType } from '@grafana/data';

import { LegacyVariableQueryEditor } from './LegacyVariableQueryEditor';
import { getVariableQueryEditor, StandardVariableQueryEditor } from './getVariableQueryEditor';

describe('getVariableQueryEditor', () => {
  describe('happy cases', () => {
    describe('when called with a data source with custom variable support', () => {
      it('then it should return correct editor', async () => {
        const editor = StandardVariableQueryEditor;
        const datasource = {
          variables: { getType: () => VariableSupportType.Custom, query: jest.fn(), editor },
        } as unknown as DataSourceApi;

        const result = await getVariableQueryEditor(datasource);

        expect(result).toBe(editor);
      });
    });

    describe('when called with a data source with standard variable support', () => {
      it('then it should return correct editor', async () => {
        const editor = StandardVariableQueryEditor;
        const datasource = {
          variables: { getType: () => VariableSupportType.Standard, toDataQuery: jest.fn() },
        } as unknown as DataSourceApi;

        const result = await getVariableQueryEditor(datasource);

        expect(result).toBe(editor);
      });
    });

    describe('when called with a data source with datasource variable support', () => {
      it('then it should return correct editor', async () => {
        const editor = StandardVariableQueryEditor;
        const plugin = { components: { QueryEditor: editor } };
        const importDataSourcePluginFunc = jest.fn().mockResolvedValue(plugin);
        const datasource = {
          variables: { getType: () => VariableSupportType.Datasource },
          meta: {},
        } as unknown as DataSourceApi;

        const result = await getVariableQueryEditor(datasource, importDataSourcePluginFunc);

        expect(result).toBe(editor);
        expect(importDataSourcePluginFunc).toHaveBeenCalledTimes(1);
        expect(importDataSourcePluginFunc).toHaveBeenCalledWith({});
      });
    });

    describe('when called with a data source with legacy variable support', () => {
      it('then it should return correct editor', async () => {
        const editor = StandardVariableQueryEditor;
        const plugin = { components: { VariableQueryEditor: editor } };
        const importDataSourcePluginFunc = jest.fn().mockResolvedValue(plugin);
        const datasource = { metricFindQuery: () => undefined, meta: {} } as unknown as DataSourceApi;

        const result = await getVariableQueryEditor(datasource, importDataSourcePluginFunc);

        expect(result).toBe(editor);
        expect(importDataSourcePluginFunc).toHaveBeenCalledTimes(1);
        expect(importDataSourcePluginFunc).toHaveBeenCalledWith({});
      });
    });
  });

  describe('negative cases', () => {
    describe('when variable support is not recognized', () => {
      it('then it should return null', async () => {
        const datasource = {} as unknown as DataSourceApi;

        const result = await getVariableQueryEditor(datasource);

        expect(result).toBeNull();
      });
    });

    describe('when called with a data source with datasource variable support but missing QueryEditor', () => {
      it('then it should return throw', async () => {
        const plugin = { components: {} };
        const importDataSourcePluginFunc = jest.fn().mockResolvedValue(plugin);
        const datasource = {
          variables: { getType: () => VariableSupportType.Datasource },
          meta: {},
        } as unknown as DataSourceApi;

        await expect(getVariableQueryEditor(datasource, importDataSourcePluginFunc)).rejects.toThrow(
          new Error('Missing QueryEditor in plugin definition.')
        );
        expect(importDataSourcePluginFunc).toHaveBeenCalledTimes(1);
        expect(importDataSourcePluginFunc).toHaveBeenCalledWith({});
      });
    });

    describe('when called with a data source with legacy variable support but missing VariableQueryEditor', () => {
      it('then it should return LegacyVariableQueryEditor', async () => {
        const plugin = { components: {} };
        const importDataSourcePluginFunc = jest.fn().mockResolvedValue(plugin);
        const datasource = { metricFindQuery: () => undefined, meta: {} } as unknown as DataSourceApi;

        const result = await getVariableQueryEditor(datasource, importDataSourcePluginFunc);

        expect(result).toBe(LegacyVariableQueryEditor);
        expect(importDataSourcePluginFunc).toHaveBeenCalledTimes(1);
        expect(importDataSourcePluginFunc).toHaveBeenCalledWith({});
      });
    });
  });
});

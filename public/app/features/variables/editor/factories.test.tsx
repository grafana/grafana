import { getVariableQueryEditor, isLegacyQueryEditor, isQueryEditor, StandardVariableQueryEditor } from './factories';
import { LegacyVariableQueryEditor } from './LegacyVariableQueryEditor';

describe('isLegacyQueryEditor', () => {
  describe('happy cases', () => {
    describe('when called with a legacy query editor but without a legacy data source', () => {
      it('then is should return true', () => {
        const component: any = LegacyVariableQueryEditor;
        const datasource: any = {};

        expect(isLegacyQueryEditor(component, datasource)).toBe(true);
      });
    });

    describe('when called with a legacy data source but without a legacy query editor', () => {
      it('then is should return true', () => {
        const component: any = StandardVariableQueryEditor;
        const datasource: any = { metricFindQuery: () => undefined };

        expect(isLegacyQueryEditor(component, datasource)).toBe(true);
      });
    });
  });

  describe('negative cases', () => {
    describe('when called without component', () => {
      it('then is should return false', () => {
        const component: any = null;
        const datasource: any = { metricFindQuery: () => undefined };

        expect(isLegacyQueryEditor(component, datasource)).toBe(false);
      });
    });

    describe('when called without a legacy query editor and without a legacy data source', () => {
      it('then is should return false', () => {
        const component: any = StandardVariableQueryEditor;
        const datasource: any = {};

        expect(isLegacyQueryEditor(component, datasource)).toBe(false);
      });
    });
  });
});

describe('isQueryEditor', () => {
  describe('happy cases', () => {
    describe('when called without a legacy editor and with a data source with standard variable support', () => {
      it('then is should return true', () => {
        const component: any = StandardVariableQueryEditor;
        const datasource: any = { variables: { type: 'standard', toDataQuery: () => undefined } };

        expect(isQueryEditor(component, datasource)).toBe(true);
      });
    });

    describe('when called without a legacy editor and with a data source with custom variable support', () => {
      it('then is should return true', () => {
        const component: any = StandardVariableQueryEditor;
        const datasource: any = { variables: { type: 'custom', query: () => undefined, editor: {} } };

        expect(isQueryEditor(component, datasource)).toBe(true);
      });
    });

    describe('when called without a legacy editor and with a data source with datasource variable support', () => {
      it('then is should return true', () => {
        const component: any = StandardVariableQueryEditor;
        const datasource: any = { variables: { type: 'datasource' } };

        expect(isQueryEditor(component, datasource)).toBe(true);
      });
    });
  });

  describe('negative cases', () => {
    describe('when called without component', () => {
      it('then is should return false', () => {
        const component: any = null;
        const datasource: any = { metricFindQuery: () => undefined };

        expect(isQueryEditor(component, datasource)).toBe(false);
      });
    });

    describe('when called with a legacy query editor', () => {
      it('then is should return false', () => {
        const component: any = LegacyVariableQueryEditor;
        const datasource: any = { variables: { type: 'datasource' } };

        expect(isQueryEditor(component, datasource)).toBe(false);
      });
    });

    describe('when called without a legacy query editor but with a legacy data source', () => {
      it('then is should return false', () => {
        const component: any = StandardVariableQueryEditor;
        const datasource: any = { metricFindQuery: () => undefined };

        expect(isQueryEditor(component, datasource)).toBe(false);
      });
    });
  });
});

describe('getVariableQueryEditor', () => {
  describe('happy cases', () => {
    describe('when called with a data source with custom variable support', () => {
      it('then it should return correct editor', async () => {
        const editor: any = StandardVariableQueryEditor;
        const datasource: any = { variables: { type: 'custom', query: () => undefined, editor } };

        const result = await getVariableQueryEditor(datasource);

        expect(result).toBe(editor);
      });
    });

    describe('when called with a data source with standard variable support', () => {
      it('then it should return correct editor', async () => {
        const editor: any = StandardVariableQueryEditor;
        const datasource: any = { variables: { type: 'standard', toDataQuery: () => undefined } };

        const result = await getVariableQueryEditor(datasource);

        expect(result).toBe(editor);
      });
    });

    describe('when called with a data source with datasource variable support', () => {
      it('then it should return correct editor', async () => {
        const editor: any = StandardVariableQueryEditor;
        const plugin = { components: { QueryEditor: editor } };
        const importDataSourcePluginFunc = jest.fn().mockResolvedValue(plugin);
        const datasource: any = { variables: { type: 'datasource' }, meta: {} };

        const result = await getVariableQueryEditor(datasource, importDataSourcePluginFunc);

        expect(result).toBe(editor);
        expect(importDataSourcePluginFunc).toHaveBeenCalledTimes(1);
        expect(importDataSourcePluginFunc).toHaveBeenCalledWith({});
      });
    });

    describe('when called with a data source with legacy variable support', () => {
      it('then it should return correct editor', async () => {
        const editor: any = StandardVariableQueryEditor;
        const plugin = { components: { VariableQueryEditor: editor } };
        const importDataSourcePluginFunc = jest.fn().mockResolvedValue(plugin);
        const datasource: any = { metricFindQuery: () => undefined, meta: {} };

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
        const datasource: any = {};

        const result = await getVariableQueryEditor(datasource);

        expect(result).toBeNull();
      });
    });

    describe('when called with a data source with datasource variable support but missing QueryEditor', () => {
      it('then it should return throw', async () => {
        const plugin = { components: {} };
        const importDataSourcePluginFunc = jest.fn().mockResolvedValue(plugin);
        const datasource: any = { variables: { type: 'datasource' }, meta: {} };

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
        const datasource: any = { metricFindQuery: () => undefined, meta: {} };

        const result = await getVariableQueryEditor(datasource, importDataSourcePluginFunc);

        expect(result).toBe(LegacyVariableQueryEditor);
        expect(importDataSourcePluginFunc).toHaveBeenCalledTimes(1);
        expect(importDataSourcePluginFunc).toHaveBeenCalledWith({});
      });
    });
  });
});

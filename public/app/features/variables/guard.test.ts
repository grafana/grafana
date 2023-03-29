import { DataSourceApi, TypedVariableModel, VariableSupportType, VariableType } from '@grafana/data';

import { LegacyVariableQueryEditor } from './editor/LegacyVariableQueryEditor';
import { StandardVariableQueryEditor } from './editor/getVariableQueryEditor';
import {
  hasCustomVariableSupport,
  hasDatasourceVariableSupport,
  hasLegacyVariableSupport,
  hasStandardVariableSupport,
  isLegacyQueryEditor,
  isQueryEditor,
  isMulti,
  hasOptions,
  hasCurrent,
} from './guard';
import {
  createAdhocVariable,
  createConstantVariable,
  createCustomVariable,
  createDashboardVariable,
  createDatasourceVariable,
  createIntervalVariable,
  createOrgVariable,
  createQueryVariable,
  createTextBoxVariable,
  createUserVariable,
} from './state/__tests__/fixtures';

describe('type guards', () => {
  describe('hasLegacyVariableSupport', () => {
    describe('when called with a legacy data source', () => {
      it('should return true', () => {
        const datasource = { metricFindQuery: () => undefined } as unknown as DataSourceApi;
        expect(hasLegacyVariableSupport(datasource)).toBe(true);
      });
    });

    describe('when called with data source without metricFindQuery function', () => {
      it('should return false', () => {
        const datasource = {} as DataSourceApi;
        expect(hasLegacyVariableSupport(datasource)).toBe(false);
      });
    });

    describe('when called with a legacy data source with variable support', () => {
      it('should return false', () => {
        const datasource = { metricFindQuery: () => undefined, variables: {} } as unknown as DataSourceApi;
        expect(hasLegacyVariableSupport(datasource)).toBe(false);
      });
    });
  });

  describe('hasStandardVariableSupport', () => {
    describe('when called with a data source with standard variable support', () => {
      it('should return true', () => {
        const datasource = {
          metricFindQuery: () => undefined,
          variables: { getType: () => VariableSupportType.Standard, toDataQuery: () => undefined },
        } as unknown as DataSourceApi;
        expect(hasStandardVariableSupport(datasource)).toBe(true);
      });

      describe('and with a custom query', () => {
        it('should return true', () => {
          const datasource = {
            metricFindQuery: () => undefined,
            variables: {
              getType: () => VariableSupportType.Standard,
              toDataQuery: () => undefined,
              query: () => undefined,
            },
          } as unknown as DataSourceApi;
          expect(hasStandardVariableSupport(datasource)).toBe(true);
        });
      });
    });

    describe('when called with a data source with partial standard variable support', () => {
      it('should return false', () => {
        const datasource = {
          metricFindQuery: () => undefined,
          variables: { getType: () => VariableSupportType.Standard, query: () => undefined },
        } as unknown as DataSourceApi;
        expect(hasStandardVariableSupport(datasource)).toBe(false);
      });
    });

    describe('when called with a data source without standard variable support', () => {
      it('should return false', () => {
        const datasource = { metricFindQuery: () => undefined } as unknown as DataSourceApi;
        expect(hasStandardVariableSupport(datasource)).toBe(false);
      });
    });
  });

  describe('hasCustomVariableSupport', () => {
    describe('when called with a data source with custom variable support', () => {
      it('should return true', () => {
        const datasource = {
          metricFindQuery: () => undefined,
          variables: { getType: () => VariableSupportType.Custom, query: () => undefined, editor: {} },
        } as unknown as DataSourceApi;
        expect(hasCustomVariableSupport(datasource)).toBe(true);
      });
    });

    describe('when called with a data source with custom variable support but without editor', () => {
      it('should return false', () => {
        const datasource = {
          metricFindQuery: () => undefined,
          variables: { getType: () => VariableSupportType.Custom, query: () => undefined },
        } as unknown as DataSourceApi;
        expect(hasCustomVariableSupport(datasource)).toBe(false);
      });
    });

    describe('when called with a data source with custom variable support but without query', () => {
      it('should return false', () => {
        const datasource = {
          metricFindQuery: () => undefined,
          variables: { getType: () => VariableSupportType.Custom, editor: {} },
        } as unknown as DataSourceApi;
        expect(hasCustomVariableSupport(datasource)).toBe(false);
      });
    });

    describe('when called with a data source without custom variable support', () => {
      it('should return false', () => {
        const datasource = { metricFindQuery: () => undefined } as unknown as DataSourceApi;
        expect(hasCustomVariableSupport(datasource)).toBe(false);
      });
    });
  });

  describe('hasDatasourceVariableSupport', () => {
    describe('when called with a data source with datasource variable support', () => {
      it('should return true', () => {
        const datasource = {
          metricFindQuery: () => undefined,
          variables: { getType: () => VariableSupportType.Datasource },
        } as unknown as DataSourceApi;
        expect(hasDatasourceVariableSupport(datasource)).toBe(true);
      });
    });

    describe('when called with a data source without datasource variable support', () => {
      it('should return false', () => {
        const datasource = { metricFindQuery: () => undefined } as unknown as DataSourceApi;
        expect(hasDatasourceVariableSupport(datasource)).toBe(false);
      });
    });
  });

  interface VariableFacts {
    variable: TypedVariableModel;
    isMulti: boolean;
    hasOptions: boolean;
    hasCurrent: boolean;
  }
  // This structure is typed (because the key is a const string union) to ensure that we always
  // test every type of variable, as new variables are added
  type ExtraVariableTypes = 'org' | 'dashboard' | 'user';
  // prettier-ignore
  const variableFactsObj: Record<VariableType | ExtraVariableTypes, VariableFacts> = {
    query:      { variable: createQueryVariable(),      isMulti: true,  hasOptions: true,  hasCurrent: true },
    adhoc:      { variable: createAdhocVariable(),      isMulti: false, hasOptions: false, hasCurrent: false },
    constant:   { variable: createConstantVariable(),   isMulti: false, hasOptions: true,  hasCurrent: true },
    datasource: { variable: createDatasourceVariable(), isMulti: true,  hasOptions: true,  hasCurrent: true },
    interval:   { variable: createIntervalVariable(),   isMulti: false, hasOptions: true,  hasCurrent: true },
    textbox:    { variable: createTextBoxVariable(),    isMulti: false, hasOptions: true,  hasCurrent: true },
    system:     { variable: createUserVariable(),       isMulti: false, hasOptions: false, hasCurrent: true },
    user:       { variable: createUserVariable(),       isMulti: false, hasOptions: false, hasCurrent: true },
    org:        { variable: createOrgVariable(),        isMulti: false, hasOptions: false, hasCurrent: true },
    dashboard:  { variable: createDashboardVariable(),  isMulti: false, hasOptions: false, hasCurrent: true },
    custom:     { variable: createCustomVariable(),     isMulti: true,  hasOptions: true,  hasCurrent: true },
  };

  const variableFacts = Object.values(variableFactsObj);

  it.each(variableFacts)(
    'isMulti correctly identifies variables with multi support: $variable.type should be $isMulti',
    ({ variable, isMulti: expected }) => {
      expect(isMulti(variable)).toBe(expected);
    }
  );

  it.each(variableFacts)(
    'hasOptions correctly identifies variables with options support: $variable.type should be $hasOptions',
    ({ variable, hasOptions: expected }) => {
      expect(hasOptions(variable)).toBe(expected);
    }
  );

  it.each(variableFacts)(
    'hasCurrent correctly identifies variables with options support: $variable.type should be $hasCurrent',
    ({ variable, hasCurrent: expected }) => {
      expect(hasCurrent(variable)).toBe(expected);
    }
  );
});

describe('isLegacyQueryEditor', () => {
  describe('happy cases', () => {
    describe('when called with a legacy query editor but without a legacy data source', () => {
      it('then is should return true', () => {
        const component = LegacyVariableQueryEditor;
        const datasource = {} as DataSourceApi;

        expect(isLegacyQueryEditor(component, datasource)).toBe(true);
      });
    });

    describe('when called with a legacy data source but without a legacy query editor', () => {
      it('then is should return true', () => {
        const component = StandardVariableQueryEditor;
        const datasource = { metricFindQuery: () => undefined } as unknown as DataSourceApi;

        expect(isLegacyQueryEditor(component, datasource)).toBe(true);
      });
    });
  });

  describe('negative cases', () => {
    describe('when called without component', () => {
      it('then is should return false', () => {
        const component = null;
        const datasource = { metricFindQuery: () => undefined } as unknown as DataSourceApi;

        expect(isLegacyQueryEditor(component, datasource)).toBe(false);
      });
    });

    describe('when called without a legacy query editor and without a legacy data source', () => {
      it('then is should return false', () => {
        const component = StandardVariableQueryEditor;
        const datasource = {} as unknown as DataSourceApi;

        expect(isLegacyQueryEditor(component, datasource)).toBe(false);
      });
    });
  });
});

describe('isQueryEditor', () => {
  describe('happy cases', () => {
    describe('when called without a legacy editor and with a data source with standard variable support', () => {
      it('then is should return true', () => {
        const component = StandardVariableQueryEditor;
        const datasource = {
          variables: { getType: () => VariableSupportType.Standard, toDataQuery: () => undefined },
        } as unknown as DataSourceApi;

        expect(isQueryEditor(component, datasource)).toBe(true);
      });
    });

    describe('when called without a legacy editor and with a data source with custom variable support', () => {
      it('then is should return true', () => {
        const component = StandardVariableQueryEditor;
        const datasource = {
          variables: { getType: () => VariableSupportType.Custom, query: () => undefined, editor: {} },
        } as unknown as DataSourceApi;

        expect(isQueryEditor(component, datasource)).toBe(true);
      });
    });

    describe('when called without a legacy editor and with a data source with datasource variable support', () => {
      it('then is should return true', () => {
        const component = StandardVariableQueryEditor;
        const datasource = { variables: { getType: () => VariableSupportType.Datasource } } as unknown as DataSourceApi;

        expect(isQueryEditor(component, datasource)).toBe(true);
      });
    });
  });

  describe('negative cases', () => {
    describe('when called without component', () => {
      it('then is should return false', () => {
        const component = null;
        const datasource = { metricFindQuery: () => undefined } as unknown as DataSourceApi;

        expect(isQueryEditor(component, datasource)).toBe(false);
      });
    });

    describe('when called with a legacy query editor', () => {
      it('then is should return false', () => {
        const component = LegacyVariableQueryEditor;
        const datasource = { variables: { getType: () => VariableSupportType.Datasource } } as unknown as DataSourceApi;

        expect(isQueryEditor(component, datasource)).toBe(false);
      });
    });

    describe('when called without a legacy query editor but with a legacy data source', () => {
      it('then is should return false', () => {
        const component = StandardVariableQueryEditor;
        const datasource = { metricFindQuery: () => undefined } as unknown as DataSourceApi;

        expect(isQueryEditor(component, datasource)).toBe(false);
      });
    });
  });
});

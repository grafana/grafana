import { DataSourceApi } from '@grafana/data';
import { config, setTemplateSrv, TemplateSrv } from '@grafana/runtime';
import {
  CustomVariable,
  ConstantVariable,
  IntervalVariable,
  QueryVariable,
  DataSourceVariable,
  AdHocFiltersVariable,
  GroupByVariable,
  TextBoxVariable,
  SceneVariableSet,
  SceneVariable,
} from '@grafana/scenes';
import { DataQuery, DataSourceJsonData, VariableHide, VariableType } from '@grafana/schema';
import { SHARED_DASHBOARD_QUERY, DASHBOARD_DATASOURCE_PLUGIN_ID } from 'app/plugins/datasource/dashboard/constants';

import { AdHocFiltersVariableEditor } from './editors/AdHocFiltersVariableEditor';
import { ConstantVariableEditor } from './editors/ConstantVariableEditor';
import { CustomVariableEditor } from './editors/CustomVariableEditor';
import { DataSourceVariableEditor } from './editors/DataSourceVariableEditor';
import { GroupByVariableEditor } from './editors/GroupByVariableEditor';
import { IntervalVariableEditor } from './editors/IntervalVariableEditor';
import { QueryVariableEditor } from './editors/QueryVariableEditor';
import { TextBoxVariableEditor } from './editors/TextBoxVariableEditor';
import {
  isEditableVariableType,
  EDITABLE_VARIABLES,
  EDITABLE_VARIABLES_SELECT_ORDER,
  getVariableTypeSelectOptions,
  getVariableEditor,
  getVariableScene,
  hasVariableOptions,
  EditableVariableType,
  getDefinition,
  getOptionDataSourceTypes,
  getNextAvailableId,
  getVariableDefault,
  isSceneVariableInstance,
  validateVariableName,
} from './utils';

const templateSrv = {
  getAdhocFilters: jest.fn().mockReturnValue([{ key: 'origKey', operator: '=', value: '' }]),
} as unknown as TemplateSrv;

const dsMock: DataSourceApi = {
  meta: {
    id: DASHBOARD_DATASOURCE_PLUGIN_ID,
  },
  name: SHARED_DASHBOARD_QUERY,
  type: SHARED_DASHBOARD_QUERY,
  uid: SHARED_DASHBOARD_QUERY,
  getRef: () => {
    return { type: SHARED_DASHBOARD_QUERY, uid: SHARED_DASHBOARD_QUERY };
  },
} as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: async () => dsMock,
    getList: () => {
      return [
        {
          name: 'DataSourceInstance1',
          uid: 'ds1',
          meta: {
            name: 'ds1',
            id: 'dsTestDataSource',
          },
        },
      ];
    },
  }),
}));

describe('isEditableVariableType', () => {
  it('should return true for editable variable types', () => {
    const editableTypes: VariableType[] = [
      'custom',
      'query',
      'constant',
      'interval',
      'datasource',
      'adhoc',
      'groupby',
      'textbox',
    ];
    editableTypes.forEach((type) => {
      expect(isEditableVariableType(type)).toBe(true);
    });
  });

  it('should return false for non-editable variable types', () => {
    const nonEditableTypes: VariableType[] = ['system'];
    nonEditableTypes.forEach((type) => {
      expect(isEditableVariableType(type)).toBe(false);
    });
  });
});

describe('isSceneVariableInstance', () => {
  it.each([
    CustomVariable,
    QueryVariable,
    ConstantVariable,
    IntervalVariable,
    DataSourceVariable,
    AdHocFiltersVariable,
    GroupByVariable,
    TextBoxVariable,
  ])('should return true for scene variable instances %s', (instanceType) => {
    const variable = new instanceType({ name: 'MyVariable' });
    expect(isSceneVariableInstance(variable)).toBe(true);
  });

  it('should return false for non-scene variable instances', () => {
    const variable = {
      name: 'MyVariable',
      type: 'query',
    };
    expect(variable).not.toBeInstanceOf(QueryVariable);
  });
});

describe('getVariableTypeSelectOptions', () => {
  describe('when groupByVariable is enabled', () => {
    beforeAll(() => {
      config.featureToggles.groupByVariable = true;
    });

    afterAll(() => {
      config.featureToggles.groupByVariable = false;
    });

    it('should contain all editable variable types', () => {
      const options = getVariableTypeSelectOptions();
      expect(options).toHaveLength(Object.keys(EDITABLE_VARIABLES).length);

      EDITABLE_VARIABLES_SELECT_ORDER.forEach((type) => {
        expect(EDITABLE_VARIABLES).toHaveProperty(type);
      });
    });

    it('should return an array of selectable values for editable variable types', () => {
      const options = getVariableTypeSelectOptions();
      expect(options).toHaveLength(8);

      options.forEach((option, index) => {
        const editableType = EDITABLE_VARIABLES_SELECT_ORDER[index];
        const variableTypeConfig = EDITABLE_VARIABLES[editableType];

        expect(option.value).toBe(editableType);
        expect(option.label).toBe(variableTypeConfig.name);
        expect(option.description).toBe(variableTypeConfig.description);
      });
    });
  });

  describe('when groupByVariable is disabled', () => {
    it('should contain all editable variable types except groupby', () => {
      const options = getVariableTypeSelectOptions();
      expect(options).toHaveLength(Object.keys(EDITABLE_VARIABLES).length - 1);

      EDITABLE_VARIABLES_SELECT_ORDER.forEach((type) => {
        expect(EDITABLE_VARIABLES).toHaveProperty(type);
      });
    });

    it('should return an array of selectable values for editable variable types', () => {
      const options = getVariableTypeSelectOptions();
      expect(options).toHaveLength(7);

      options.forEach((option, index) => {
        const editableType = EDITABLE_VARIABLES_SELECT_ORDER[index];
        const variableTypeConfig = EDITABLE_VARIABLES[editableType];

        expect(option.value).toBe(editableType);
        expect(option.label).toBe(variableTypeConfig.name);
        expect(option.description).toBe(variableTypeConfig.description);
      });
    });
  });
});

describe('getVariableEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(Object.keys(EDITABLE_VARIABLES) as EditableVariableType[])(
    'should define an editor for variable type "%s"',
    (type) => {
      const editor = getVariableEditor(type);
      expect(editor).toBeDefined();
    }
  );

  it.each([
    ['custom', CustomVariableEditor],
    ['query', QueryVariableEditor],
    ['constant', ConstantVariableEditor],
    ['interval', IntervalVariableEditor],
    ['datasource', DataSourceVariableEditor],
    ['adhoc', AdHocFiltersVariableEditor],
    ['groupby', GroupByVariableEditor],
    ['textbox', TextBoxVariableEditor],
  ])('should return the correct editor for variable type "%s"', (type, ExpectedVariableEditor) => {
    expect(getVariableEditor(type as EditableVariableType)).toBe(ExpectedVariableEditor);
  });
});

describe('getVariableScene', () => {
  beforeAll(() => {
    setTemplateSrv(templateSrv);
  });

  it.each(Object.keys(EDITABLE_VARIABLES) as EditableVariableType[])(
    'should define a scene object for every variable type',
    (type) => {
      const variable = getVariableScene(type, { name: 'foo' });
      expect(variable).toBeDefined();
    }
  );

  it.each([
    ['custom', CustomVariable],
    ['query', QueryVariable],
    ['interval', IntervalVariable],
    ['datasource', DataSourceVariable],
    ['adhoc', AdHocFiltersVariable],
    ['groupby', GroupByVariable],
    ['textbox', TextBoxVariable],
  ])('should return the scene variable instance for the given editable variable type', (type, instanceType) => {
    const initialState = { name: 'MyVariable' };
    const sceneVariable = getVariableScene(type as EditableVariableType, initialState);
    expect(sceneVariable).toBeInstanceOf(instanceType);
    expect(sceneVariable.state.name).toBe(initialState.name);
    expect(sceneVariable.state.hide).toBe(undefined);
  });

  it('should return the scene variable instance for the constant editable variable type', () => {
    const initialState = { name: 'MyVariable' };
    const sceneVariable = getVariableScene('constant' as EditableVariableType, initialState);
    expect(sceneVariable).toBeInstanceOf(ConstantVariable);
    expect(sceneVariable.state.name).toBe(initialState.name);
    expect(sceneVariable.state.hide).toBe(VariableHide.hideVariable);
  });
});

describe('hasVariableOptions', () => {
  it('should return true for scene variables with options property', () => {
    const variableWithOptions = new CustomVariable({
      name: 'MyVariable',
      options: [{ value: 'option1', label: 'Option 1' }],
    });
    expect(hasVariableOptions(variableWithOptions)).toBe(true);
  });

  it('should return false for scene variables without options property', () => {
    const variableWithoutOptions = new ConstantVariable({ name: 'MyVariable' });
    expect(hasVariableOptions(variableWithoutOptions)).toBe(false);
  });
});

describe('getDefinition', () => {
  it('returns the correct definition for QueryVariable when definition is defined', () => {
    const model = new QueryVariable({
      name: 'custom0',
      query: '',
      definition: 'legacy ABC query definition',
    });
    expect(getDefinition(model)).toBe('legacy ABC query definition');
  });

  it('returns the correct definition for QueryVariable when definition is not defined', () => {
    const model = new QueryVariable({
      name: 'custom0',
      query: 'ABC query',
      definition: '',
    });
    expect(getDefinition(model)).toBe('ABC query');
  });

  it('returns the correct definition for DataSourceVariable', () => {
    const model = new DataSourceVariable({
      name: 'ds0',
      pluginId: 'datasource-plugin',
      value: 'datasource-value',
    });
    expect(getDefinition(model)).toBe('datasource-plugin');
  });

  it('returns the correct definition for CustomVariable', () => {
    const model = new CustomVariable({
      name: 'custom0',
      query: 'Custom, A, B, C',
    });
    expect(getDefinition(model)).toBe('Custom, A, B, C');
  });

  it('returns the correct definition for IntervalVariable', () => {
    const model = new IntervalVariable({
      name: 'interval0',
      intervals: ['1m', '5m', '15m', '30m', '1h', '6h', '12h', '1d'],
    });
    expect(getDefinition(model)).toBe('1m,5m,15m,30m,1h,6h,12h,1d');
  });

  it('returns the correct definition for TextBoxVariable', () => {
    const model = new TextBoxVariable({
      name: 'textbox0',
      value: 'TextBox Value',
    });
    expect(getDefinition(model)).toBe('TextBox Value');
  });

  it('returns the correct definition for ConstantVariable', () => {
    const model = new ConstantVariable({
      name: 'constant0',
      value: 'Constant Value',
    });
    expect(getDefinition(model)).toBe('Constant Value');
  });
});

describe('getOptionDataSourceTypes', () => {
  it('should return all data source types when no data source types are specified', () => {
    const optionTypes = getOptionDataSourceTypes();
    expect(optionTypes).toHaveLength(2);
    // in the old code we always had an empty option
    expect(optionTypes[0].value).toBe('');
    expect(optionTypes[1].label).toBe('ds1');
  });
});

describe('getNextAvailableId', () => {
  it('should return the initial ID for an empty array', () => {
    const sceneVariables = new SceneVariableSet({
      variables: [],
    });

    expect(getNextAvailableId('query', sceneVariables.state.variables)).toBe('query0');
  });

  it('should return a non-conflicting ID for a non-empty array', () => {
    const variable = new QueryVariable({
      name: 'query0',
      label: 'test-label',
      description: 'test-desc',
      value: ['selected-value'],
      text: ['selected-value-text'],
      datasource: { uid: 'fake-std', type: 'fake-std' },
      query: 'query',
      includeAll: true,
      allValue: 'test-all',
      isMulti: true,
    });

    const sceneVariables = new SceneVariableSet({
      variables: [variable],
    });

    expect(getNextAvailableId('query', sceneVariables.state.variables)).toBe('query1');
  });
});

describe('getVariableDefault', () => {
  it('should return a QueryVariable instance with the correct name', () => {
    const sceneVariables = new SceneVariableSet({
      variables: [],
    });

    const defaultVariable = getVariableDefault(sceneVariables.state.variables);

    expect(defaultVariable).toBeInstanceOf(QueryVariable);
    expect(defaultVariable.state.name).toBe('query0');
  });
});

describe('Variables name validation', () => {
  let variable1: SceneVariable;
  let variable2: SceneVariable;

  beforeAll(async () => {
    variable1 = new CustomVariable({
      name: 'customVar',
      query: 'test, test2',
      value: 'test',
      text: 'test',
    });
    variable2 = new CustomVariable({
      name: 'customVar2',
      query: 'test3, test4, $customVar',
      value: '$customVar',
      text: '$customVar',
    });

    new SceneVariableSet({ variables: [variable1, variable2] });
  });

  it('should not return error on same name and key', () => {
    expect(validateVariableName(variable1, variable1.state.name).isValid).toBe(true);
  });

  it('should not return error if name is unique', () => {
    expect(validateVariableName(variable1, 'unique_variable_name').isValid).toBe(true);
  });

  it('should return error if global variable name is used', () => {
    expect(validateVariableName(variable1, '__').isValid).toBe(false);
  });

  it('should not return error if global variable name is used not at the beginning ', () => {
    expect(validateVariableName(variable1, 'test__').isValid).toBe(true);
  });

  it('should return error if name is empty', () => {
    expect(validateVariableName(variable1, '').isValid).toBe(false);
  });

  it('should return error if non word characters are used', () => {
    expect(validateVariableName(variable1, '-').isValid).toBe(false);
  });

  it('should return error if variable name is taken', () => {
    expect(validateVariableName(variable1, variable2.state.name).isValid).toBe(false);
  });
});

import { type DataSourceApi } from '@grafana/data';
import { config, setTemplateSrv, type TemplateSrv } from '@grafana/runtime';
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
  type SceneVariable,
  SceneFlexLayout,
  SceneFlexItem,
} from '@grafana/scenes';
import { type DataQuery, type DataSourceJsonData, VariableHide, type VariableType } from '@grafana/schema';
import { SHARED_DASHBOARD_QUERY, DASHBOARD_DATASOURCE_PLUGIN_ID } from 'app/plugins/datasource/dashboard/constants';

import { toControlSourceRef } from '../../utils/predefinedVariables';

import { AdHocFiltersVariableEditor } from './editors/AdHocFiltersVariableEditor';
import { ConstantVariableEditor } from './editors/ConstantVariableEditor';
import { CustomVariableEditor } from './editors/CustomVariableEditor/CustomVariableEditor';
import { DataSourceVariableEditor } from './editors/DataSourceVariableEditor';
import { GroupByVariableEditor } from './editors/GroupByVariableEditor';
import { IntervalVariableEditor } from './editors/IntervalVariableEditor';
import { QueryVariableEditor } from './editors/QueryVariableEditor/QueryVariableEditor';
import { TextBoxVariableEditor } from './editors/TextBoxVariableEditor';
import {
  isEditableVariableType,
  EDITABLE_VARIABLES_SELECT_ORDER,
  getEditableVariables,
  getVariableTypeLabel,
  getVariableTypeSelectOptions,
  getVariableEditor,
  getVariableScene,
  hasVariableOptions,
  type EditableVariableType,
  getDefinition,
  getOptionDataSourceTypes,
  getNextAvailableId,
  getVariableDefault,
  isSceneVariableInstance,
  isVariableEditable,
  getPredefinedVariableShadowWarning,
  dropPredefinedVariableNamed,
  dropShadowedPredefinedVariables,
  restoreUnshadowedPredefinedVariables,
  restoreVariableSetSnapshots,
  snapshotSetsWithPredefinedNamed,
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

const defaultDsSettings = {
  name: 'DataSourceInstance1',
  uid: 'ds1',
  type: 'dsTestDataSource',
  meta: {
    name: 'ds1',
    id: 'dsTestDataSource',
  },
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: async () => dsMock,
    getInstanceSettings: (ref: string | null) => (ref === null ? defaultDsSettings : undefined),
    getList: () => [defaultDsSettings],
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
    const nonEditableTypes: VariableType[] = ['system', 'snapshot'];
    nonEditableTypes.forEach((type) => {
      expect(isEditableVariableType(type)).toBe(false);
    });
  });
});

describe('isVariableEditable', () => {
  it('returns false when variable has an origin', () => {
    const variable = new CustomVariable({
      name: 'globalVar',
      query: 'a,b',
      origin: toControlSourceRef({ type: 'global' }),
    });

    expect(isVariableEditable(variable)).toBe(false);
  });

  it('returns false for non-editable variable types', () => {
    expect(isVariableEditable({ state: { type: 'system', origin: undefined } } as SceneVariable)).toBe(false);
  });

  it('returns true for dashboard-local variables', () => {
    const variable = new CustomVariable({ name: 'localVar', query: 'a,b' });
    expect(isVariableEditable(variable)).toBe(true);
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
      const editableVariables = getEditableVariables();
      expect(options).toHaveLength(Object.keys(editableVariables).length);

      EDITABLE_VARIABLES_SELECT_ORDER.forEach((type) => {
        expect(editableVariables).toHaveProperty(type);
      });
    });

    it('should return an array of selectable values for editable variable types', () => {
      const editableVariables = getEditableVariables();
      const options = getVariableTypeSelectOptions();
      expect(options).toHaveLength(9);

      options.forEach((option, index) => {
        const editableType = EDITABLE_VARIABLES_SELECT_ORDER[index];
        const variableTypeConfig = editableVariables[editableType];

        expect(option.value).toBe(editableType);
        expect(option.label).toBe(variableTypeConfig.name);
        expect(option.description).toBe(variableTypeConfig.description);
      });
    });
  });

  describe('when groupByVariable is disabled', () => {
    it('should contain all editable variable types except groupby', () => {
      const editableVariables = getEditableVariables();
      const options = getVariableTypeSelectOptions();
      expect(options).toHaveLength(Object.keys(editableVariables).length - 1);

      EDITABLE_VARIABLES_SELECT_ORDER.forEach((type) => {
        expect(editableVariables).toHaveProperty(type);
      });
    });

    it('should return an array of selectable values for editable variable types', () => {
      const editableVariables = getEditableVariables();
      const options = getVariableTypeSelectOptions();
      expect(options).toHaveLength(8);

      options.forEach((option, index) => {
        const editableType = EDITABLE_VARIABLES_SELECT_ORDER[index];
        const variableTypeConfig = editableVariables[editableType];

        expect(option.value).toBe(editableType);
        expect(option.label).toBe(variableTypeConfig.name);
        expect(option.description).toBe(variableTypeConfig.description);
      });
    });
  });

  describe('when dashboardUnifiedDrilldownControls is enabled', () => {
    beforeAll(() => {
      config.featureToggles.dashboardUnifiedDrilldownControls = true;
    });

    afterAll(() => {
      config.featureToggles.dashboardUnifiedDrilldownControls = false;
    });

    it('should hide adhoc in the dashboard context', () => {
      const values = getVariableTypeSelectOptions().map((o) => o.value);
      expect(values).not.toContain('adhoc');
    });

    it('should show adhoc as "Filter and Group by" in the standalone context', () => {
      const options = getVariableTypeSelectOptions({ standalone: true });
      expect(options.map((o) => o.value)).toContain('adhoc');

      const adhoc = options.find((o) => o.value === 'adhoc');
      expect(adhoc?.label).toBe('Filter and Group by');
      expect(adhoc?.description).toBe('Add key/value filters and group by keys on the fly');
    });
  });

  describe('when dashboardUnifiedDrilldownControls is disabled', () => {
    it('standalone context should match the dashboard context', () => {
      const standaloneOptions = getVariableTypeSelectOptions({ standalone: true });
      expect(standaloneOptions).toEqual(getVariableTypeSelectOptions());

      const adhoc = standaloneOptions.find((o) => o.value === 'adhoc');
      expect(adhoc?.label).toBe('Filter');
    });
  });
});

describe('getVariableTypeLabel', () => {
  afterEach(() => {
    config.featureToggles.dashboardUnifiedDrilldownControls = false;
  });

  it('returns the editable variable name by default', () => {
    expect(getVariableTypeLabel('adhoc')).toBe('Filter');
    expect(getVariableTypeLabel('custom')).toBe('Custom');
  });

  describe('when dashboardUnifiedDrilldownControls is enabled', () => {
    beforeEach(() => {
      config.featureToggles.dashboardUnifiedDrilldownControls = true;
    });

    it('relabels adhoc in the standalone context only', () => {
      expect(getVariableTypeLabel('adhoc', { standalone: true })).toBe('Filter and Group by');
      expect(getVariableTypeLabel('adhoc')).toBe('Filter');
    });
  });
});

describe('getVariableEditor', () => {
  const editableVariables = getEditableVariables();
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(Object.keys(editableVariables) as EditableVariableType[])(
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
  const editableVariables = getEditableVariables();
  beforeAll(() => {
    setTemplateSrv(templateSrv);
  });

  it.each(Object.keys(editableVariables) as EditableVariableType[])(
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
    expect(optionTypes).toHaveLength(1);
    expect(optionTypes[0].label).toBe('ds1');
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

describe('Cross-level variable name validation', () => {
  it('should return warning when section variable shadows a dashboard variable', () => {
    const dashboardVar = new CustomVariable({ name: 'myVar', query: 'a,b' });
    const sectionVar = new CustomVariable({ name: 'other', query: 'c,d' });

    new SceneFlexLayout({
      $variables: new SceneVariableSet({ variables: [dashboardVar] }),
      children: [
        new SceneFlexItem({
          $variables: new SceneVariableSet({ variables: [sectionVar] }),
          body: undefined,
        }),
      ],
    });

    const result = validateVariableName(sectionVar, 'myVar');
    expect(result.isValid).toBe(true);
    expect(result.warningMessage).toBe(
      'A variable with this name already exists at the dashboard level. This variable will overwrite it.'
    );
    expect(result.errorMessage).toBeUndefined();
  });

  it('should return warning when dashboard variable collides with a section variable', () => {
    const dashboardVar = new CustomVariable({ name: 'other', query: 'a,b' });
    const sectionVar = new CustomVariable({ name: 'myVar', query: 'c,d' });

    new SceneFlexLayout({
      $variables: new SceneVariableSet({ variables: [dashboardVar] }),
      children: [
        new SceneFlexItem({
          $variables: new SceneVariableSet({ variables: [sectionVar] }),
          body: undefined,
        }),
      ],
    });

    const result = validateVariableName(dashboardVar, 'myVar');
    expect(result.isValid).toBe(true);
    expect(result.warningMessage).toBe(
      'A variable with this name already exists in a section. This variable will be ignored in that section.'
    );
    expect(result.errorMessage).toBeUndefined();
  });

  it('should not return warning when names do not conflict across levels', () => {
    const dashboardVar = new CustomVariable({ name: 'dashVar', query: 'a,b' });
    const sectionVar = new CustomVariable({ name: 'secVar', query: 'c,d' });

    new SceneFlexLayout({
      $variables: new SceneVariableSet({ variables: [dashboardVar] }),
      children: [
        new SceneFlexItem({
          $variables: new SceneVariableSet({ variables: [sectionVar] }),
          body: undefined,
        }),
      ],
    });

    const dashResult = validateVariableName(dashboardVar, 'dashVar');
    expect(dashResult.isValid).toBe(true);
    expect(dashResult.warningMessage).toBeUndefined();
    expect(dashResult.errorMessage).toBeUndefined();

    const secResult = validateVariableName(sectionVar, 'secVar');
    expect(secResult.isValid).toBe(true);
    expect(secResult.warningMessage).toBeUndefined();
    expect(secResult.errorMessage).toBeUndefined();
  });
});

describe('Predefined variable name shadowing', () => {
  it('should return warning when dashboard variable shadows a predefined global variable', () => {
    const predefined = new CustomVariable({
      name: 'env',
      query: 'prod,dev',
      origin: toControlSourceRef({ type: 'global' }),
    });
    const local = new CustomVariable({ name: 'localVar', query: 'a,b' });
    new SceneVariableSet({ variables: [predefined, local] });

    const result = validateVariableName(local, 'env');
    expect(result.isValid).toBe(true);
    expect(result.warningMessage).toBe(getPredefinedVariableShadowWarning());
    expect(result.errorMessage).toBeUndefined();
  });

  it('should return warning when dashboard variable shadows a predefined folder variable', () => {
    const predefined = new CustomVariable({
      name: 'env',
      query: 'prod,dev',
      origin: toControlSourceRef({ type: 'folder', folderUid: 'folder-1' }),
    });
    const local = new CustomVariable({ name: 'localVar', query: 'a,b' });
    new SceneVariableSet({ variables: [predefined, local] });

    const result = validateVariableName(local, 'env');
    expect(result.isValid).toBe(true);
    expect(result.warningMessage).toBe(getPredefinedVariableShadowWarning());
    expect(result.errorMessage).toBeUndefined();
  });

  it('should still error when two dashboard-local variables share a name', () => {
    const local1 = new CustomVariable({ name: 'env', query: 'a,b' });
    const local2 = new CustomVariable({ name: 'other', query: 'c,d' });
    new SceneVariableSet({ variables: [local1, local2] });

    const result = validateVariableName(local2, 'env');
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBe('Variable with the same name already exists');
  });

  it('should return predefined warning when section variable shadows a predefined root variable', () => {
    const predefined = new CustomVariable({
      name: 'env',
      query: 'prod,dev',
      origin: toControlSourceRef({ type: 'global' }),
    });
    const sectionVar = new CustomVariable({ name: 'other', query: 'c,d' });

    new SceneFlexLayout({
      $variables: new SceneVariableSet({ variables: [predefined] }),
      children: [
        new SceneFlexItem({
          $variables: new SceneVariableSet({ variables: [sectionVar] }),
          body: undefined,
        }),
      ],
    });

    const result = validateVariableName(sectionVar, 'env');
    expect(result.isValid).toBe(true);
    expect(result.warningMessage).toBe(getPredefinedVariableShadowWarning());
    expect(result.errorMessage).toBeUndefined();
  });

  it('dropPredefinedVariableNamed removes only the predefined entry', () => {
    const predefined = new CustomVariable({
      name: 'env',
      query: 'prod,dev',
      origin: toControlSourceRef({ type: 'global' }),
    });
    const local = new CustomVariable({ name: 'localVar', query: 'a,b' });
    const set = new SceneVariableSet({ variables: [predefined, local] });

    dropPredefinedVariableNamed(set, 'env');

    expect(set.state.variables).toHaveLength(1);
    expect(set.state.variables[0]).toBe(local);
  });

  it('dropShadowedPredefinedVariables drops ancestor predefined when section renames onto it', () => {
    const predefined = new CustomVariable({
      name: 'env',
      query: 'prod,dev',
      origin: toControlSourceRef({ type: 'global' }),
    });
    const sectionVar = new CustomVariable({ name: 'other', query: 'c,d' });
    const rootSet = new SceneVariableSet({ variables: [predefined] });

    new SceneFlexLayout({
      $variables: rootSet,
      children: [
        new SceneFlexItem({
          $variables: new SceneVariableSet({ variables: [sectionVar] }),
          body: undefined,
        }),
      ],
    });

    dropShadowedPredefinedVariables(sectionVar, 'env');

    expect(rootSet.state.variables).toHaveLength(0);
  });

  it('snapshotSetsWithPredefinedNamed + restore restores dropped predefined after an intermediate name', () => {
    const predefined = new CustomVariable({
      name: 'env',
      query: 'prod,dev',
      origin: toControlSourceRef({ type: 'global' }),
    });
    const local = new CustomVariable({ name: 'localVar', query: 'a,b' });
    const set = new SceneVariableSet({ variables: [predefined, local] });

    // Typing through "env" must not permanently lose the predefined: snapshot, drop only on
    // the intermediate match, then restore when the committed name moves on.
    const snapshotsAtEnv = snapshotSetsWithPredefinedNamed(local, 'env');
    expect(snapshotsAtEnv).toHaveLength(1);

    dropShadowedPredefinedVariables(local, 'env');
    expect(set.state.variables).toEqual([local]);

    restoreVariableSetSnapshots(snapshotsAtEnv);
    expect(set.state.variables).toEqual([predefined, local]);

    // Commit as "env2" — no predefined named env2, so nothing to drop.
    const snapshotsAtEnv2 = snapshotSetsWithPredefinedNamed(local, 'env2');
    expect(snapshotsAtEnv2).toHaveLength(0);
    dropShadowedPredefinedVariables(local, 'env2');
    expect(set.state.variables).toEqual([predefined, local]);
  });

  it('restoreUnshadowedPredefinedVariables re-injects after a shadowing local is renamed away', () => {
    const predefined = new CustomVariable({
      name: 'env',
      query: 'prod,dev',
      origin: toControlSourceRef({ type: 'global' }),
    });
    const local = new CustomVariable({ name: 'env', query: 'a,b' });
    const set = new SceneVariableSet({ variables: [predefined, local] });

    dropShadowedPredefinedVariables(local, 'env');
    expect(set.state.variables).toEqual([local]);

    local.setState({ name: 'localVar' });
    restoreUnshadowedPredefinedVariables(local);

    expect(set.state.variables).toEqual([predefined, local]);
  });

  it('restoreUnshadowedPredefinedVariables re-injects after a shadowing local is deleted', () => {
    const predefined = new CustomVariable({
      name: 'env',
      query: 'prod,dev',
      origin: toControlSourceRef({ type: 'global' }),
    });
    const local = new CustomVariable({ name: 'env', query: 'a,b' });
    const set = new SceneVariableSet({ variables: [predefined, local] });

    dropPredefinedVariableNamed(set, 'env');
    set.setState({ variables: set.state.variables.filter((v) => v !== local) });
    expect(set.state.variables).toEqual([]);

    restoreUnshadowedPredefinedVariables(set);

    expect(set.state.variables).toEqual([predefined]);
  });

  it('restoreUnshadowedPredefinedVariables re-injects ancestor predefined when section renames away', () => {
    const predefined = new CustomVariable({
      name: 'env',
      query: 'prod,dev',
      origin: toControlSourceRef({ type: 'global' }),
    });
    const sectionVar = new CustomVariable({ name: 'env', query: 'c,d' });
    const rootSet = new SceneVariableSet({ variables: [predefined] });

    new SceneFlexLayout({
      $variables: rootSet,
      children: [
        new SceneFlexItem({
          $variables: new SceneVariableSet({ variables: [sectionVar] }),
          body: undefined,
        }),
      ],
    });

    dropShadowedPredefinedVariables(sectionVar, 'env');
    expect(rootSet.state.variables).toHaveLength(0);

    sectionVar.setState({ name: 'other' });
    restoreUnshadowedPredefinedVariables(sectionVar);

    expect(rootSet.state.variables).toEqual([predefined]);
  });
});

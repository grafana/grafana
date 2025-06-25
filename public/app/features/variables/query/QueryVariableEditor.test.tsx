import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';

import { QueryVariableModel, VariableSupportType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';

import { NEW_VARIABLE_ID } from '../constants';
import { LegacyVariableQueryEditor } from '../editor/LegacyVariableQueryEditor';
import { KeyedVariableIdentifier } from '../state/types';

import { Props, QueryVariableEditorUnConnected } from './QueryVariableEditor';
import { initialQueryVariableModelState } from './reducer';

const mockDS = mockDataSource({
  name: 'CloudManager',
  type: DataSourceType.Alertmanager,
});
const ds = new MockDataSourceApi(mockDS);
const editor = jest.fn().mockImplementation(LegacyVariableQueryEditor);

ds.variables = {
  getType: () => VariableSupportType.Custom,
  query: jest.fn(),
  editor: editor,
  getDefaultQuery: jest.fn(),
};

const setupTestContext = async (options: Partial<Props>) => {
  const variableDefaults: Partial<QueryVariableModel> = { rootStateKey: 'key' };
  const extended = {
    VariableQueryEditor: LegacyVariableQueryEditor,
    dataSource: ds,
  };

  const defaults: Props = {
    variable: { ...initialQueryVariableModelState, ...variableDefaults },
    initQueryVariableEditor: jest.fn(),
    changeQueryVariableDataSource: jest.fn(),
    changeQueryVariableQuery: jest.fn(),
    changeVariableMultiValue: jest.fn(),
    extended,
    onPropChange: jest.fn(),
  };

  const props: Props & Record<string, unknown> = { ...defaults, ...options };
  const { rerender } = await act(() => render(<QueryVariableEditorUnConnected {...props} />));

  return { rerender, props };
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: async () => ds,
    getList: () => [mockDS],
    getInstanceSettings: () => mockDS,
  }),
}));

const defaultIdentifier: KeyedVariableIdentifier = { type: 'query', rootStateKey: 'key', id: NEW_VARIABLE_ID };

describe('QueryVariableEditor', () => {
  describe('when the component is mounted', () => {
    it('then it should call initQueryVariableEditor', async () => {
      const { props } = await setupTestContext({});

      expect(props.initQueryVariableEditor).toHaveBeenCalledTimes(1);
      expect(props.initQueryVariableEditor).toHaveBeenCalledWith(defaultIdentifier);
    });
  });

  describe('when the editor is rendered', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should pass down the query with default values if the datasource config defines it', async () => {
      await setupTestContext({});
      expect(ds.variables?.getDefaultQuery).toBeDefined();
      // getDefaultQuery is called twice: once in QueryEditor to account for old arch
      //   and once in QueryVariableForm for new scenes arch logic
      expect(ds.variables?.getDefaultQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the user changes', () => {
    it.each`
      fieldName  | propName                      | expectedArgs
      ${'query'} | ${'changeQueryVariableQuery'} | ${[defaultIdentifier, 't', '']}
      ${'regex'} | ${'onPropChange'}             | ${[{ propName: 'regex', propValue: 't', updateOptions: true }]}
    `(
      '$fieldName field and tabs away then $propName should be called with correct args',
      async ({ fieldName, propName, expectedArgs }) => {
        const { props } = await setupTestContext({});
        const propUnderTest = props[propName];
        const fieldAccessor = fieldAccessors[fieldName];

        await userEvent.type(fieldAccessor(), 't');
        await userEvent.tab();

        expect(propUnderTest).toHaveBeenCalledTimes(1);
        expect(propUnderTest).toHaveBeenCalledWith(...expectedArgs);
      }
    );
  });

  describe('when the user changes', () => {
    it.each`
      fieldName  | propName
      ${'query'} | ${'changeQueryVariableQuery'}
      ${'regex'} | ${'onPropChange'}
    `(
      '$fieldName field but reverts the change and tabs away then $propName should not be called',
      async ({ fieldName, propName }) => {
        const { props } = await setupTestContext({});
        const propUnderTest = props[propName];
        const fieldAccessor = fieldAccessors[fieldName];

        await userEvent.type(fieldAccessor(), 't');
        await userEvent.type(fieldAccessor(), '{backspace}');
        await userEvent.tab();

        expect(propUnderTest).not.toHaveBeenCalled();
      }
    );
  });
});

const getQueryField = () =>
  screen.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput);

const getRegExField = () => screen.getByLabelText(/Regex/);

const fieldAccessors: Record<string, () => HTMLElement> = {
  query: getQueryField,
  regex: getRegExField,
};

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DataSourceApi } from '@grafana/data';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';

import { NEW_VARIABLE_ID } from '../constants';
import { LegacyVariableQueryEditor } from '../editor/LegacyVariableQueryEditor';
import { KeyedVariableIdentifier } from '../state/types';
import { QueryVariableModel } from '../types';

import { Props, QueryVariableEditorUnConnected } from './QueryVariableEditor';
import { initialQueryVariableModelState } from './reducer';

const setupTestContext = (options: Partial<Props>) => {
  const variableDefaults: Partial<QueryVariableModel> = { rootStateKey: 'key' };
  const extended = {
    VariableQueryEditor: LegacyVariableQueryEditor,
    dataSource: {} as unknown as DataSourceApi,
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

  const props: Props & Record<string, any> = { ...defaults, ...options };
  const { rerender } = render(<QueryVariableEditorUnConnected {...props} />);

  return { rerender, props };
};

const mockDS = mockDataSource({
  name: 'CloudManager',
  type: DataSourceType.Alertmanager,
});

jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => {
  return {
    getDataSourceSrv: () => ({
      get: () => Promise.resolve(mockDS),
      getList: () => [mockDS],
      getInstanceSettings: () => mockDS,
    }),
  };
});

const defaultIdentifier: KeyedVariableIdentifier = { type: 'query', rootStateKey: 'key', id: NEW_VARIABLE_ID };

describe('QueryVariableEditor', () => {
  describe('when the component is mounted', () => {
    it('then it should call initQueryVariableEditor', () => {
      const { props } = setupTestContext({});

      expect(props.initQueryVariableEditor).toHaveBeenCalledTimes(1);
      expect(props.initQueryVariableEditor).toHaveBeenCalledWith(defaultIdentifier);
    });
  });

  describe('when the user changes', () => {
    it.each`
      fieldName  | propName                      | expectedArgs
      ${'query'} | ${'changeQueryVariableQuery'} | ${[defaultIdentifier, 't', 't']}
      ${'regex'} | ${'onPropChange'}             | ${[{ propName: 'regex', propValue: 't', updateOptions: true }]}
    `(
      '$fieldName field and tabs away then $propName should be called with correct args',
      async ({ fieldName, propName, expectedArgs }) => {
        const { props } = setupTestContext({});
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
        const { props } = setupTestContext({});
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
  screen.getByRole('textbox', { name: /variable editor form default variable query editor textarea/i });

const getRegExField = () => screen.getByLabelText(/Regex/);

const fieldAccessors: Record<string, () => HTMLElement> = {
  query: getQueryField,
  regex: getRegExField,
};

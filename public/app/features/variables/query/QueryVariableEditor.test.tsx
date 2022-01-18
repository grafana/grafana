import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataSourceApi } from '@grafana/data';

import { Props, QueryVariableEditorUnConnected } from './QueryVariableEditor';
import { initialQueryVariableModelState } from './reducer';
import { initialVariableEditorState } from '../editor/reducer';
import { describe, expect } from '../../../../test/lib/common';
import { LegacyVariableQueryEditor } from '../editor/LegacyVariableQueryEditor';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import { NEW_VARIABLE_ID } from '../constants';

const setupTestContext = (options: Partial<Props>) => {
  const defaults: Props = {
    variable: { ...initialQueryVariableModelState },
    initQueryVariableEditor: jest.fn(),
    changeQueryVariableDataSource: jest.fn(),
    changeQueryVariableQuery: jest.fn(),
    changeVariableMultiValue: jest.fn(),
    editor: {
      ...initialVariableEditorState,
      extended: {
        VariableQueryEditor: LegacyVariableQueryEditor,
        dataSource: ({} as unknown) as DataSourceApi,
      },
    },
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

describe('QueryVariableEditor', () => {
  describe('when the component is mounted', () => {
    it('then it should call initQueryVariableEditor', () => {
      const { props } = setupTestContext({});

      expect(props.initQueryVariableEditor).toHaveBeenCalledTimes(1);
      expect(props.initQueryVariableEditor).toHaveBeenCalledWith({ type: 'query', id: NEW_VARIABLE_ID });
    });
  });

  describe('when the user changes', () => {
    it.each`
      fieldName  | propName                      | expectedArgs
      ${'query'} | ${'changeQueryVariableQuery'} | ${[{ type: 'query', id: NEW_VARIABLE_ID }, 't', 't']}
      ${'regex'} | ${'onPropChange'}             | ${[{ propName: 'regex', propValue: 't', updateOptions: true }]}
    `(
      '$fieldName field and tabs away then $propName should be called with correct args',
      ({ fieldName, propName, expectedArgs }) => {
        const { props } = setupTestContext({});
        const propUnderTest = props[propName];
        const fieldAccessor = fieldAccessors[fieldName];

        userEvent.type(fieldAccessor(), 't');
        userEvent.tab();

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
      ({ fieldName, propName }) => {
        const { props } = setupTestContext({});
        const propUnderTest = props[propName];
        const fieldAccessor = fieldAccessors[fieldName];

        userEvent.type(fieldAccessor(), 't');
        userEvent.type(fieldAccessor(), '{backspace}');
        userEvent.tab();

        expect(propUnderTest).not.toHaveBeenCalled();
      }
    );
  });
});

const getQueryField = () =>
  screen.getByRole('textbox', { name: /variable editor form default variable query editor textarea/i });

const getRegExField = () => screen.getByRole('textbox', { name: /variable editor form query regex field/i });

const fieldAccessors: Record<string, () => HTMLElement> = {
  query: getQueryField,
  regex: getRegExField,
};

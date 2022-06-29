import { Store } from 'redux';

import { FieldType, toDataFrame } from '@grafana/data';
import * as keyedVariablesReducer from 'app/features/variables/state/keyedVariablesReducer';
import * as selectors from 'app/features/variables/state/selectors';
import { StoreState } from 'app/types';

import { getQueryConditionItems, queryConditionsRegistry } from './QueryConditionsRegistry';
import { ValueClickConditionOptions } from './conditions/FieldValueClickConditionEditor';
import { findRelatedDataLinks } from './getConditionalDataLinksSupplier';
import { QueryConditionConfig, QueryConditionID } from './types';

jest.spyOn(selectors, 'getVariablesByKey').mockReturnValue([]);
jest.spyOn(selectors, 'getNewVariableIndex').mockReturnValue(0);
jest.spyOn(selectors, 'getLastKey').mockReturnValue('lastKey');
// eslint-disable-next-line
jest.spyOn(keyedVariablesReducer, 'toKeyedAction').mockReturnValue({} as any);
jest.spyOn(selectors, 'getVariable').mockImplementation((id) => {
  // eslint-disable-next-line
  return {} as any;
});

describe('findRelatedDataLinks', () => {
  beforeAll(() => {
    queryConditionsRegistry.setInit(getQueryConditionItems);
  });

  test('returns data links for a superset of provided condition if matching fields are available', () => {
    const target1Conditions: QueryConditionConfig<ValueClickConditionOptions> = {
      id: QueryConditionID.ValueClick,
      options: {
        name: 'field1',
        pattern: 'field1',
      },
    };

    const target2Conditions = [
      target1Conditions,
      {
        id: QueryConditionID.ValueClick,
        options: {
          name: 'field2',
          pattern: 'field2',
        },
      },
    ];

    const frame = toDataFrame({
      name: 'Series A',
      fields: [{ name: 'field1' }, { name: 'field2' }],
    });

    const allFrames = [frame];
    const field = frame.fields[0];
    const allConditions = [[target1Conditions], target2Conditions];

    const result = findRelatedDataLinks(target1Conditions, allConditions, frame, allFrames, field);

    expect(result.length).toBe(2);
    expect(result[0].title).toBe('Drill down on field1');
    expect(result[1].title).toBe('Drill down on field1, field2');
  });

  test('returns data links for a superset of provided condition if matching template variable is available', () => {
    const target1Conditions: QueryConditionConfig<ValueClickConditionOptions> = {
      id: QueryConditionID.ValueClick,
      options: {
        name: 'field1',
        pattern: 'field1',
      },
    };

    const target2Conditions = [
      target1Conditions,
      {
        id: QueryConditionID.ValueClick,
        options: {
          name: 'field2',
          pattern: 'field2',
        },
      },
      {
        id: QueryConditionID.ValueClick,
        options: {
          name: 'field3',
          pattern: 'field3',
        },
      },
    ];

    const frame = toDataFrame({
      name: 'Series A',
      fields: [{ name: 'field1' }, { name: 'field2' }],
    });

    const allFrames = [frame];
    const field = frame.fields[0];
    const allConditions = [[target1Conditions], target2Conditions];

    /* eslint-disable */
    const result = findRelatedDataLinks(target1Conditions, allConditions, frame, allFrames, field, {
      getVariableWithName: (name) =>
        name === 'valueClickField3'
          ? {
              name: 'valueClickField3',
              id: 'valueClickField3',
              type: 'keyValue',
              current: {
                selected: true,
                text: 'field3 value',
                value: 'field3 value',
              },
            }
          : undefined,
      store: {} as Store<StoreState>,
      //   @ts-ignore
      actions: { addVariable: () => ({}) },
    });
    /* eslint-enable */

    expect(result.length).toBe(2);
    expect(result[0].title).toBe('Drill down on field1');
    expect(result[1].title).toBe('Drill down on field1, field2, field3');
  });

  describe('related data links handlers', () => {
    const dispatchMock = jest.fn();
    const addVariableMock = jest.fn();
    const adapterSetValueMock = jest.fn();
    beforeEach(() => {
      addVariableMock.mockReset();
      adapterSetValueMock.mockReset();
    });

    test('when using values from data frame only', async () => {
      const target1Conditions: QueryConditionConfig<ValueClickConditionOptions> = {
        id: QueryConditionID.ValueClick,
        options: {
          name: 'field1',
          pattern: 'field1',
        },
      };

      const target2Conditions = [
        target1Conditions,
        {
          id: QueryConditionID.ValueClick,
          options: {
            name: 'field2',
            pattern: 'field2',
          },
        },
      ];

      const frame = toDataFrame({
        name: 'Series A',
        fields: [
          { name: 'field1', type: FieldType.number, values: [11, 12, 13] },
          { name: 'field2', type: FieldType.number, values: [21, 22, 23] },
        ],
      });

      const allFrames = [frame];
      const field = frame.fields[0];
      const allConditions = [[target1Conditions], target2Conditions];

      const adapterSetValueMock = jest.fn();

      /* eslint-disable */
      const result = findRelatedDataLinks(target1Conditions, allConditions, frame, allFrames, field, {
        // assuming all data comes from data frame
        getVariableWithName: () => undefined,
        store: { dispatch: dispatchMock, getState: () => ({}) } as any,
        actions: {
          // @ts-ignore
          addVariable: addVariableMock,
        },
        getKeyValueAdapter: () => {
          return {
            setValue: adapterSetValueMock,
          } as any;
        },
      });
      /* eslint-enable */

      // Simluate clicking on field1, row 1
      // Drill down on field1
      await result[0].onClick!({}, { field: frame.fields[0], rowIndex: 1 });

      expect(adapterSetValueMock).toHaveBeenCalledTimes(1);
      expect(adapterSetValueMock).toHaveBeenCalledWith(
        {},
        {
          selected: true,
          text: '12',
          value: 12,
        },
        true
      );
      expect(addVariableMock).toHaveBeenCalledTimes(1);

      adapterSetValueMock.mockReset();
      addVariableMock.mockReset();
      expect(adapterSetValueMock).toHaveBeenCalledTimes(0);
      expect(addVariableMock).toHaveBeenCalledTimes(0);

      // Simulate clicking on field1, field2,  row 1
      // Drill down on field1 and field2
      await result[1].onClick!({}, { field: frame.fields[0], rowIndex: 1 });

      expect(adapterSetValueMock).toHaveBeenCalledTimes(2);
      expect(adapterSetValueMock).toHaveBeenNthCalledWith(
        1,
        {},
        {
          selected: true,
          text: '12',
          value: 12,
        },
        false
      );
      expect(adapterSetValueMock).toHaveBeenNthCalledWith(
        2,
        {},
        {
          selected: true,
          text: '22',
          value: 22,
        },
        true
      );
      expect(addVariableMock).toHaveBeenCalledTimes(2);
    });

    test('when using values from data frame and template variables', async () => {
      const target1Conditions: QueryConditionConfig<ValueClickConditionOptions> = {
        id: QueryConditionID.ValueClick,
        options: {
          name: 'field1',
          pattern: 'field1',
        },
      };

      const target2Conditions = [
        target1Conditions,
        {
          id: QueryConditionID.ValueClick,
          options: {
            name: 'field2',
            pattern: 'field2',
          },
        },
        {
          id: QueryConditionID.ValueClick,
          options: {
            name: 'field3',
            pattern: 'field3',
          },
        },
      ];

      const frame = toDataFrame({
        name: 'Series A',
        fields: [
          { name: 'field1', type: FieldType.number, values: [11, 12, 13] },
          { name: 'field2', type: FieldType.number, values: [21, 22, 23] },
        ],
      });

      const allFrames = [frame];
      const field = frame.fields[0];
      const allConditions = [[target1Conditions], target2Conditions];

      /* eslint-disable */
      const result = findRelatedDataLinks(target1Conditions, allConditions, frame, allFrames, field, {
        // assuming there is only valueClickField3 variable in the store
        getVariableWithName: (name) =>
          name === 'valueClickField3'
            ? {
                name: 'valueClickField3',
                id: 'valueClickField3',
                type: 'keyValue',
                current: {
                  selected: true,
                  text: 'field3 value',
                  value: 'field3 value',
                },
              }
            : undefined,
        store: { dispatch: dispatchMock, getState: () => ({}) } as any,
        actions: {
          // @ts-ignore
          addVariable: addVariableMock,
        },
        getKeyValueAdapter: () => {
          return {
            setValue: adapterSetValueMock,
          } as any;
        },
      });
      /* eslint-enable */

      // Simulate clicking on field1, field2, field3  row 1
      // Drill down on field1, field2, field3 (field3 value exists as a template var and is not in the data frame)
      await result[1].onClick!({}, { field: frame.fields[0], rowIndex: 1 });
      expect(addVariableMock).toHaveBeenCalledTimes(2);
      expect(adapterSetValueMock).toHaveBeenCalledTimes(2);
      expect(adapterSetValueMock).toHaveBeenNthCalledWith(
        1,
        {},
        {
          selected: true,
          text: '12',
          value: 12,
        },
        false
      );
      expect(adapterSetValueMock).toHaveBeenNthCalledWith(
        2,
        {},
        {
          selected: true,
          text: '22',
          value: 22,
        },
        true
      );
    });
  });
});

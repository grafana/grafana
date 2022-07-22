import { of } from 'rxjs';

import { FieldType, toDataFrame } from '@grafana/data';

import { queryBuilder } from '../shared/testing/builders';
import { toKeyedAction } from '../state/keyedVariablesReducer';

import { areMetricFindValues, toMetricFindValues, updateOptionsState, validateVariableSelection } from './operators';
import { updateVariableOptions } from './reducer';

describe('operators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateVariableSelection', () => {
    describe('when called', () => {
      it('then the correct observable should be created', async () => {
        const variable = queryBuilder().withId('query').withRootStateKey('key').build();
        const dispatch = jest.fn().mockResolvedValue({});
        const observable = of(undefined).pipe(validateVariableSelection({ variable, dispatch }));

        await expect(observable).toEmitValuesWith((received) => {
          expect(received[0]).toEqual({});
          expect(dispatch).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  describe('updateOptionsState', () => {
    describe('when called', () => {
      it('then the correct observable should be created', async () => {
        const variable = queryBuilder().withId('query').withRootStateKey('key').build();
        const dispatch = jest.fn();
        const getTemplatedRegexFunc = jest.fn().mockReturnValue('getTemplatedRegexFunc result');

        const observable = of([{ text: 'A' }]).pipe(updateOptionsState({ variable, dispatch, getTemplatedRegexFunc }));

        await expect(observable).toEmitValuesWith((received) => {
          const value = received[0];
          expect(value).toEqual(undefined);
          expect(getTemplatedRegexFunc).toHaveBeenCalledTimes(1);
          expect(dispatch).toHaveBeenCalledTimes(1);
          expect(dispatch).toHaveBeenCalledWith(
            toKeyedAction(
              'key',
              updateVariableOptions({
                id: 'query',
                type: 'query',
                data: { results: [{ text: 'A' }], templatedRegex: 'getTemplatedRegexFunc result' },
              })
            )
          );
        });
      });
    });
  });

  describe('toMetricFindValues', () => {
    const frameWithTextField = toDataFrame({
      fields: [{ name: 'text', type: FieldType.string, values: ['A', 'B', 'C'] }],
    });
    const frameWithValueField = toDataFrame({
      fields: [{ name: 'value', type: FieldType.string, values: ['A', 'B', 'C'] }],
    });
    const frameWithTextAndValueField = toDataFrame({
      fields: [
        { name: 'text', type: FieldType.string, values: ['TA', 'TB', 'TC'] },
        { name: 'value', type: FieldType.string, values: ['VA', 'VB', 'VC'] },
      ],
    });
    const frameWithAStringField = toDataFrame({
      fields: [{ name: 'label', type: FieldType.string, values: ['A', 'B', 'C'] }],
    });
    const frameWithExpandableField = toDataFrame({
      fields: [
        { name: 'label', type: FieldType.string, values: ['A', 'B', 'C'] },
        { name: 'expandable', type: FieldType.boolean, values: [true, false, true] },
      ],
    });

    // it.each wouldn't work here as we need the done callback
    [
      { series: null, expected: [] },
      { series: undefined, expected: [] },
      { series: [], expected: [] },
      { series: [{ text: '' }], expected: [{ text: '' }] },
      { series: [{ value: '' }], expected: [{ value: '' }] },
      {
        series: [frameWithTextField],
        expected: [
          { text: 'A', value: 'A' },
          { text: 'B', value: 'B' },
          { text: 'C', value: 'C' },
        ],
      },
      {
        series: [frameWithValueField],
        expected: [
          { text: 'A', value: 'A' },
          { text: 'B', value: 'B' },
          { text: 'C', value: 'C' },
        ],
      },
      {
        series: [frameWithTextAndValueField],
        expected: [
          { text: 'TA', value: 'VA' },
          { text: 'TB', value: 'VB' },
          { text: 'TC', value: 'VC' },
        ],
      },
      {
        series: [frameWithAStringField],
        expected: [
          { text: 'A', value: 'A' },
          { text: 'B', value: 'B' },
          { text: 'C', value: 'C' },
        ],
      },
      {
        series: [frameWithExpandableField],
        expected: [
          { text: 'A', value: 'A', expandable: true },
          { text: 'B', value: 'B', expandable: false },
          { text: 'C', value: 'C', expandable: true },
        ],
      },
    ].map((scenario) => {
      it(`when called with series:${JSON.stringify(scenario.series, null, 0)}`, async () => {
        const { series, expected } = scenario;
        const panelData: any = { series };
        const observable = of(panelData).pipe(toMetricFindValues());

        await expect(observable).toEmitValuesWith((received) => {
          const value = received[0];
          expect(value).toEqual(expected);
        });
      });
    });

    describe('when called without metric find values and string fields', () => {
      it('then the observable throws', async () => {
        const frameWithTimeField = toDataFrame({
          fields: [{ name: 'time', type: FieldType.time, values: [1, 2, 3] }],
        });

        const panelData: any = { series: [frameWithTimeField] };
        const observable = of(panelData).pipe(toMetricFindValues());

        await expect(observable).toEmitValuesWith((received) => {
          const value = received[0];
          expect(value).toEqual(new Error("Couldn't find any field of type string in the results."));
        });
      });
    });
  });
});

describe('areMetricFindValues', () => {
  const frame = toDataFrame({
    fields: [{ name: 'text', type: FieldType.number, values: [1] }],
  });

  it.each`
    values                       | expected
    ${null}                      | ${false}
    ${undefined}                 | ${false}
    ${[frame]}                   | ${false}
    ${[{ text: () => {} }]}      | ${false}
    ${[{ text: { foo: 1 } }]}    | ${false}
    ${[{ text: Symbol('foo') }]} | ${false}
    ${[{ text: true }]}          | ${false}
    ${[{ text: null }]}          | ${true}
    ${[{ value: null }]}         | ${true}
    ${[]}                        | ${true}
    ${[{ text: '' }]}            | ${true}
    ${[{ Text: '' }]}            | ${true}
    ${[{ value: '' }]}           | ${true}
    ${[{ Value: '' }]}           | ${true}
    ${[{ text: '', value: '' }]} | ${true}
    ${[{ Text: '', Value: '' }]} | ${true}
    ${[{ text: 1 }]}             | ${true}
    ${[{ Text: 1 }]}             | ${true}
    ${[{ value: 1 }]}            | ${true}
    ${[{ Value: 1 }]}            | ${true}
    ${[{ text: 1, value: 1 }]}   | ${true}
    ${[{ Text: 1, Value: 1 }]}   | ${true}
  `('when called with values:$values', ({ values, expected }) => {
    expect(areMetricFindValues(values)).toBe(expected);
  });
});

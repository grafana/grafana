import { reducerTester } from '../../../../test/core/redux/reducerTester';
import {
  getAllMatches,
  queryVariableReducer,
  sortVariableValues,
  updateVariableOptions,
  updateVariableTags,
} from './reducer';
import { QueryVariableModel, VariableSort } from '../types';
import cloneDeep from 'lodash/cloneDeep';
import { VariablesState } from '../state/variablesReducer';
import { getVariableTestContext } from '../state/helpers';
import { toVariablePayload } from '../state/types';
import { createQueryVariableAdapter } from './adapter';
import { MetricFindValue, stringToJsRegex } from '@grafana/data';

describe('queryVariableReducer', () => {
  const adapter = createQueryVariableAdapter();

  describe('when updateVariableOptions is dispatched and includeAll is true', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext(adapter, { includeAll: true });
      const metrics = [createMetric('A'), createMetric('B')];
      const update = { results: metrics, templatedRegex: '' };
      const payload = toVariablePayload({ id: '0', type: 'query' }, update);

      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [
              { text: 'All', value: '$__all', selected: false },
              { text: 'A', value: 'A', selected: false },
              { text: 'B', value: 'B', selected: false },
            ],
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is false', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext(adapter, { includeAll: false });
      const metrics = [createMetric('A'), createMetric('B')];
      const update = { results: metrics, templatedRegex: '' };
      const payload = toVariablePayload({ id: '0', type: 'query' }, update);

      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [
              { text: 'A', value: 'A', selected: false },
              { text: 'B', value: 'B', selected: false },
            ],
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is true and payload is an empty array', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext(adapter, { includeAll: true });
      const update = { results: [] as MetricFindValue[], templatedRegex: '' };
      const payload = toVariablePayload({ id: '0', type: 'query' }, update);

      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [{ text: 'All', value: '$__all', selected: false }],
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is false and payload is an empty array', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext(adapter, { includeAll: false });
      const update = { results: [] as MetricFindValue[], templatedRegex: '' };
      const payload = toVariablePayload({ id: '0', type: 'query' }, update);

      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [{ text: 'None', value: '', selected: false, isNone: true }],
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is true and regex is set', () => {
    it('then state should be correct', () => {
      const regex = '/.*(a).*/i';
      const { initialState } = getVariableTestContext(adapter, { includeAll: true, regex });
      const metrics = [createMetric('A'), createMetric('B')];
      const update = { results: metrics, templatedRegex: regex };
      const payload = toVariablePayload({ id: '0', type: 'query' }, update);

      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [
              { text: 'All', value: '$__all', selected: false },
              { text: 'A', value: 'A', selected: false },
            ],
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is false and regex is set', () => {
    it('then state should be correct', () => {
      const regex = '/.*(a).*/i';
      const { initialState } = getVariableTestContext(adapter, { includeAll: false, regex });
      const metrics = [createMetric('A'), createMetric('B')];
      const update = { results: metrics, templatedRegex: regex };
      const payload = toVariablePayload({ id: '0', type: 'query' }, update);

      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [{ text: 'A', value: 'A', selected: false }],
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is false and regex is set and uses capture groups', () => {
    it('normal regex should capture in order matches', () => {
      const regex = '/somelabel="(?<text>[^"]+).*somevalue="(?<value>[^"]+)/i';
      const { initialState } = getVariableTestContext(adapter, { includeAll: false, regex });
      const metrics = [createMetric('A{somelabel="atext",somevalue="avalue"}'), createMetric('B')];
      const update = { results: metrics, templatedRegex: regex };
      const payload = toVariablePayload({ id: '0', type: 'query' }, update);

      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [{ text: 'atext', value: 'avalue', selected: false }],
          } as unknown) as QueryVariableModel,
        });
    });

    it('global regex should capture out of order matches', () => {
      const regex = '/somevalue="(?<value>[^"]+)|somelabel="(?<text>[^"]+)/gi';
      const { initialState } = getVariableTestContext(adapter, { includeAll: false, regex });
      const metrics = [createMetric('A{somelabel="atext",somevalue="avalue"}'), createMetric('B')];
      const update = { results: metrics, templatedRegex: regex };
      const payload = toVariablePayload({ id: '0', type: 'query' }, update);

      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [{ text: 'atext', value: 'avalue', selected: false }],
          } as unknown) as QueryVariableModel,
        });
    });

    it('unmatched text capture will use value capture', () => {
      const regex = '/somevalue="(?<value>[^"]+)|somelabel="(?<text>[^"]+)/gi';
      const { initialState } = getVariableTestContext(adapter, { includeAll: false, regex });
      const metrics = [createMetric('A{somename="atext",somevalue="avalue"}'), createMetric('B')];
      const update = { results: metrics, templatedRegex: regex };
      const payload = toVariablePayload({ id: '0', type: 'query' }, update);

      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [{ text: 'avalue', value: 'avalue', selected: false }],
          } as unknown) as QueryVariableModel,
        });
    });

    it('unmatched value capture will use text capture', () => {
      const regex = '/somevalue="(?<value>[^"]+)|somelabel="(?<text>[^"]+)/gi';
      const { initialState } = getVariableTestContext(adapter, { includeAll: false, regex });
      const metrics = [createMetric('A{somelabel="atext",somename="avalue"}'), createMetric('B')];
      const update = { results: metrics, templatedRegex: regex };
      const payload = toVariablePayload({ id: '0', type: 'query' }, update);

      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [{ text: 'atext', value: 'atext', selected: false }],
          } as unknown) as QueryVariableModel,
        });
    });

    it('unnamed capture group returns any unnamed match', () => {
      const regex = '/.*_(\\w+)\\{/gi';
      const { initialState } = getVariableTestContext(adapter, { includeAll: false, regex });
      const metrics = [createMetric('instance_counter{someother="atext",something="avalue"}'), createMetric('B')];
      const update = { results: metrics, templatedRegex: regex };
      const payload = toVariablePayload({ id: '0', type: 'query' }, update);

      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [{ text: 'counter', value: 'counter', selected: false }],
          } as unknown) as QueryVariableModel,
        });
    });

    it('unmatched text capture and unmatched value capture returns empty state', () => {
      const regex = '/somevalue="(?<value>[^"]+)|somelabel="(?<text>[^"]+)/gi';
      const { initialState } = getVariableTestContext(adapter, { includeAll: false, regex });
      const metrics = [createMetric('A{someother="atext",something="avalue"}'), createMetric('B')];
      const update = { results: metrics, templatedRegex: regex };
      const payload = toVariablePayload({ id: '0', type: 'query' }, update);

      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [{ text: 'None', value: '', selected: false, isNone: true }],
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when updateVariableTags is dispatched', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext(adapter);
      const tags: any[] = [{ text: 'A' }, { text: 'B' }];
      const payload = toVariablePayload({ id: '0', type: 'query' }, tags);
      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableTags(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            tags: [
              { text: 'A', selected: false },
              { text: 'B', selected: false },
            ],
          } as unknown) as QueryVariableModel,
        });
    });
  });
});

describe('sortVariableValues', () => {
  describe('when using any sortOrder with an option with null as text', () => {
    it.each`
      options                                           | sortOrder                                       | expected
      ${[{ text: '1' }, { text: null }, { text: '2' }]} | ${VariableSort.disabled}                        | ${[{ text: '1' }, { text: null }, { text: '2' }]}
      ${[{ text: 'a' }, { text: null }, { text: 'b' }]} | ${VariableSort.alphabeticalAsc}                 | ${[{ text: 'a' }, { text: 'b' }, { text: null }]}
      ${[{ text: 'a' }, { text: null }, { text: 'b' }]} | ${VariableSort.alphabeticalDesc}                | ${[{ text: null }, { text: 'b' }, { text: 'a' }]}
      ${[{ text: '1' }, { text: null }, { text: '2' }]} | ${VariableSort.numericalAsc}                    | ${[{ text: null }, { text: '1' }, { text: '2' }]}
      ${[{ text: '1' }, { text: null }, { text: '2' }]} | ${VariableSort.numericalDesc}                   | ${[{ text: '2' }, { text: '1' }, { text: null }]}
      ${[{ text: 'a' }, { text: null }, { text: 'b' }]} | ${VariableSort.alphabeticalCaseInsensitiveAsc}  | ${[{ text: null }, { text: 'a' }, { text: 'b' }]}
      ${[{ text: 'a' }, { text: null }, { text: 'b' }]} | ${VariableSort.alphabeticalCaseInsensitiveDesc} | ${[{ text: 'b' }, { text: 'a' }, { text: null }]}
    `(
      'then it should sort the options correctly without throwing (sortOrder:$sortOrder)',
      ({ options, sortOrder, expected }) => {
        const result = sortVariableValues(options, sortOrder);

        expect(result).toEqual(expected);
      }
    );
  });
});

describe('getAllMatches', () => {
  it.each`
    str                                          | regex               | expected
    ${'A{somelabel="atext",somevalue="avalue"}'} | ${'/unknown/gi'}    | ${{}}
    ${'A{somelabel="atext",somevalue="avalue"}'} | ${'/unknown/i'}     | ${{}}
    ${'A{somelabel="atext",somevalue="avalue"}'} | ${'/some(\\w+)/gi'} | ${{ 0: 'somevalue', 1: 'value', index: 20, input: 'A{somelabel="atext",somevalue="avalue"}' }}
    ${'A{somelabel="atext",somevalue="avalue"}'} | ${'/some(\\w+)/i'}  | ${{ 0: 'somelabel', 1: 'label', index: 2, input: 'A{somelabel="atext",somevalue="avalue"}' }}
    ${'A{somelabel="atext",somevalue="avalue"}'} | ${'/somevalue="(?<value>[^"]+)|somelabel="(?<text>[^"]+)/gi'} | ${{
  0: 'somevalue="avalue',
  1: 'avalue',
  2: 'atext',
  groups: {
    text: 'atext',
    value: 'avalue',
  },
  index: 20,
  input: 'A{somelabel="atext",somevalue="avalue"}',
}}
    ${'A{somelabel="atext",somevalue="avalue"}'} | ${'/somevalue="(?<value>[^"]+)|somelabel="(?<text>[^"]+)/i'} | ${{
  0: 'somelabel="atext',
  1: undefined,
  2: 'atext',
  groups: {
    text: 'atext',
  },
  index: 2,
  input: 'A{somelabel="atext",somevalue="avalue"}',
}}
  `('when called with str:{$str}, regex:{$regex} then it should return correct matches', ({ str, regex, expected }) => {
    const result = getAllMatches(str, stringToJsRegex(regex));

    expect(result).toEqual(expected);
  });
});

function createMetric(value: string) {
  return {
    text: value,
  };
}

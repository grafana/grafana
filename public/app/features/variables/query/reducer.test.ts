import { cloneDeep } from 'lodash';

import { MetricFindValue } from '@grafana/data';

import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { getVariableTestContext } from '../state/helpers';
import { VariablesState } from '../state/types';
import { QueryVariableModel, VariableSort } from '../types';
import { toVariablePayload } from '../utils';

import { createQueryVariableAdapter } from './adapter';
import {
  metricNamesToVariableValues,
  queryVariableReducer,
  sortVariableValues,
  updateVariableOptions,
} from './reducer';

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
          '0': {
            ...initialState[0],
            options: [
              { text: 'All', value: '$__all', selected: false },
              { text: 'A', value: 'A', selected: false },
              { text: 'B', value: 'B', selected: false },
            ],
          } as unknown as QueryVariableModel,
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
          '0': {
            ...initialState[0],
            options: [
              { text: 'A', value: 'A', selected: false },
              { text: 'B', value: 'B', selected: false },
            ],
          } as unknown as QueryVariableModel,
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
          '0': {
            ...initialState[0],
            options: [{ text: 'All', value: '$__all', selected: false }],
          } as unknown as QueryVariableModel,
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
          '0': {
            ...initialState[0],
            options: [{ text: 'None', value: '', selected: false, isNone: true }],
          } as unknown as QueryVariableModel,
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
          '0': {
            ...initialState[0],
            options: [
              { text: 'All', value: '$__all', selected: false },
              { text: 'A', value: 'A', selected: false },
            ],
          } as unknown as QueryVariableModel,
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
          '0': {
            ...initialState[0],
            options: [{ text: 'A', value: 'A', selected: false }],
          } as unknown as QueryVariableModel,
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
          '0': {
            ...initialState[0],
            options: [{ text: 'atext', value: 'avalue', selected: false }],
          } as unknown as QueryVariableModel,
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
          '0': {
            ...initialState[0],
            options: [{ text: 'atext', value: 'avalue', selected: false }],
          } as unknown as QueryVariableModel,
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
          '0': {
            ...initialState[0],
            options: [{ text: 'avalue', value: 'avalue', selected: false }],
          } as unknown as QueryVariableModel,
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
          '0': {
            ...initialState[0],
            options: [{ text: 'atext', value: 'atext', selected: false }],
          } as unknown as QueryVariableModel,
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
          '0': {
            ...initialState[0],
            options: [{ text: 'counter', value: 'counter', selected: false }],
          } as unknown as QueryVariableModel,
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
          '0': {
            ...initialState[0],
            options: [{ text: 'None', value: '', selected: false, isNone: true }],
          } as unknown as QueryVariableModel,
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

describe('metricNamesToVariableValues', () => {
  const item = (str: string) => ({ text: str, value: str, selected: false });
  const metricsNames = [
    item('go_info{instance="demo.robustperception.io:9090",job="prometheus",version="go1.15.6"} 1 1613047998000'),
    item('go_info{instance="demo.robustperception.io:9091",job="pushgateway",version="go1.15.6"} 1 1613047998000'),
    item('go_info{instance="demo.robustperception.io:9093",job="alertmanager",version="go1.14.4"} 1 1613047998000'),
    item('go_info{instance="demo.robustperception.io:9100",job="node",version="go1.14.4"} 1 1613047998000'),
  ];

  const expected1 = [
    { value: 'demo.robustperception.io:9090', text: 'demo.robustperception.io:9090', selected: false },
    { value: 'demo.robustperception.io:9091', text: 'demo.robustperception.io:9091', selected: false },
    { value: 'demo.robustperception.io:9093', text: 'demo.robustperception.io:9093', selected: false },
    { value: 'demo.robustperception.io:9100', text: 'demo.robustperception.io:9100', selected: false },
  ];

  const expected2 = [
    { value: 'prometheus', text: 'prometheus', selected: false },
    { value: 'pushgateway', text: 'pushgateway', selected: false },
    { value: 'alertmanager', text: 'alertmanager', selected: false },
    { value: 'node', text: 'node', selected: false },
  ];

  const expected3 = [
    { value: 'demo.robustperception.io:9090', text: 'prometheus', selected: false },
    { value: 'demo.robustperception.io:9091', text: 'pushgateway', selected: false },
    { value: 'demo.robustperception.io:9093', text: 'alertmanager', selected: false },
    { value: 'demo.robustperception.io:9100', text: 'node', selected: false },
  ];

  const expected4 = [
    { value: 'demo.robustperception.io:9090', text: 'demo.robustperception.io:9090', selected: false },
    { value: undefined, text: undefined, selected: false },
    { value: 'demo.robustperception.io:9091', text: 'demo.robustperception.io:9091', selected: false },
    { value: 'demo.robustperception.io:9093', text: 'demo.robustperception.io:9093', selected: false },
    { value: 'demo.robustperception.io:9100', text: 'demo.robustperception.io:9100', selected: false },
  ];

  it.each`
    variableRegEx                                          | expected
    ${''}                                                  | ${metricsNames}
    ${'/unknown/'}                                         | ${[]}
    ${'/unknown/g'}                                        | ${[]}
    ${'/go/'}                                              | ${metricsNames}
    ${'/go/g'}                                             | ${metricsNames}
    ${'/(go)/'}                                            | ${[{ value: 'go', text: 'go', selected: false }]}
    ${'/(go)/g'}                                           | ${[{ value: 'go', text: 'go', selected: false }]}
    ${'/(go)?/'}                                           | ${[{ value: 'go', text: 'go', selected: false }]}
    ${'/(go)?/g'}                                          | ${[{ value: 'go', text: 'go', selected: false }, { value: undefined, text: undefined, selected: false }]}
    ${'/go(\\w+)/'}                                        | ${[{ value: '_info', text: '_info', selected: false }]}
    ${'/go(\\w+)/g'}                                       | ${[{ value: '_info', text: '_info', selected: false }, { value: '1', text: '1', selected: false }]}
    ${'/.*_(\\w+)\\{/'}                                    | ${[{ value: 'info', text: 'info', selected: false }]}
    ${'/.*_(\\w+)\\{/g'}                                   | ${[{ value: 'info', text: 'info', selected: false }]}
    ${'/instance="(?<value>[^"]+)/'}                       | ${expected1}
    ${'/instance="(?<value>[^"]+)/g'}                      | ${expected1}
    ${'/instance="(?<grp1>[^"]+)/'}                        | ${expected1}
    ${'/instance="(?<grp1>[^"]+)/g'}                       | ${expected1}
    ${'/instancee="(?<value>[^"]+)/'}                      | ${[]}
    ${'/job="(?<text>[^"]+)/'}                             | ${expected2}
    ${'/job="(?<text>[^"]+)/g'}                            | ${expected2}
    ${'/job="(?<grp2>[^"]+)/'}                             | ${expected2}
    ${'/job="(?<grp2>[^"]+)/g'}                            | ${expected2}
    ${'/jobb="(?<text>[^"]+)/g'}                           | ${[]}
    ${'/instance="(?<value>[^"]+)|job="(?<text>[^"]+)/'}   | ${expected1}
    ${'/instance="(?<value>[^"]+)|job="(?<text>[^"]+)/g'}  | ${expected3}
    ${'/instance="(?<grp1>[^"]+)|job="(?<grp2>[^"]+)/'}    | ${expected1}
    ${'/instance="(?<grp1>[^"]+)|job="(?<grp2>[^"]+)/g'}   | ${expected4}
    ${'/instance="(?<value>[^"]+).*job="(?<text>[^"]+)/'}  | ${expected3}
    ${'/instance="(?<value>[^"]+).*job="(?<text>[^"]+)/g'} | ${expected3}
    ${'/instance="(?<grp1>[^"]+).*job="(?<grp2>[^"]+)/'}   | ${expected1}
    ${'/instance="(?<grp1>[^"]+).*job="(?<grp2>[^"]+)/g'}  | ${expected1}
  `('when called with variableRegEx:$variableRegEx then it return correct options', ({ variableRegEx, expected }) => {
    const result = metricNamesToVariableValues(variableRegEx, VariableSort.disabled, metricsNames);
    expect(result).toEqual(expected);
  });
});

function createMetric(value: string) {
  return {
    text: value,
  };
}

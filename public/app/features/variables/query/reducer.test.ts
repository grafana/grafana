import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { queryVariableReducer, updateVariableOptions, updateVariableTags } from './reducer';
import { QueryVariableModel } from '../types';
import cloneDeep from 'lodash/cloneDeep';
import { VariablesState } from '../state/variablesReducer';
import { getVariableTestContext } from '../state/helpers';
import { toVariablePayload } from '../state/types';
import { createQueryVariableAdapter } from './adapter';
import { MetricFindValue } from '@grafana/data';

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

function createMetric(value: string) {
  return {
    text: value,
  };
}

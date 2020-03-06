import { UrlQueryMap } from '@grafana/runtime';

import {
  getModel,
  getTemplatingAndLocationRootReducer,
  getTemplatingRootReducer,
  variableMockBuilder,
} from './helpers';
import { variableAdapters } from '../adapters';
import { createQueryVariableAdapter } from '../query/adapter';
import { createCustomVariableAdapter } from '../custom/adapter';
import { createTextBoxVariableAdapter } from '../textbox/adapter';
import { createConstantVariableAdapter } from '../constant/adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from 'app/features/templating/state/reducers';
import { initDashboardTemplating, processVariables, setOptionFromUrl } from './actions';
import { addInitLock, addVariable, removeInitLock, resolveInitLock, setCurrentVariableValue } from './sharedReducer';
import { toVariableIdentifier, toVariablePayload } from './types';

describe('shared actions', () => {
  describe('when initDashboardTemplating is dispatched', () => {
    it('then correct actions are dispatched', () => {
      variableAdapters.set('query', createQueryVariableAdapter());
      variableAdapters.set('custom', createCustomVariableAdapter());
      variableAdapters.set('textbox', createTextBoxVariableAdapter());
      variableAdapters.set('constant', createConstantVariableAdapter());
      const query = getModel('query');
      const constant = getModel('constant');
      const datasource = getModel('datasource');
      const custom = getModel('custom');
      const textbox = getModel('textbox');
      const list = [query, constant, datasource, custom, textbox];

      reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating(list))
        .thenDispatchedActionPredicateShouldEqual(dispatchedActions => {
          expect(dispatchedActions.length).toEqual(8);
          expect(dispatchedActions[0]).toEqual(
            addVariable(toVariablePayload(query, { global: false, index: 0, model: query }))
          );
          expect(dispatchedActions[1]).toEqual(
            addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant }))
          );
          expect(dispatchedActions[2]).toEqual(
            addVariable(toVariablePayload(custom, { global: false, index: 2, model: custom }))
          );
          expect(dispatchedActions[3]).toEqual(
            addVariable(toVariablePayload(textbox, { global: false, index: 3, model: textbox }))
          );

          // because uuid are dynamic we need to get the uuid from the resulting state
          // an alternative would be to add our own uuids in the model above instead
          expect(dispatchedActions[4]).toEqual(
            addInitLock(toVariablePayload({ ...query, uuid: dispatchedActions[4].payload.uuid }))
          );
          expect(dispatchedActions[5]).toEqual(
            addInitLock(toVariablePayload({ ...constant, uuid: dispatchedActions[5].payload.uuid }))
          );
          expect(dispatchedActions[6]).toEqual(
            addInitLock(toVariablePayload({ ...custom, uuid: dispatchedActions[6].payload.uuid }))
          );
          expect(dispatchedActions[7]).toEqual(
            addInitLock(toVariablePayload({ ...textbox, uuid: dispatchedActions[7].payload.uuid }))
          );

          return true;
        });
    });
  });

  describe('when processVariables is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      variableAdapters.set('query', createQueryVariableAdapter());
      variableAdapters.set('custom', createCustomVariableAdapter());
      variableAdapters.set('textbox', createTextBoxVariableAdapter());
      variableAdapters.set('constant', createConstantVariableAdapter());
      const query = getModel('query');
      const constant = getModel('constant');
      const datasource = getModel('datasource');
      const custom = getModel('custom');
      const textbox = getModel('textbox');
      const list = [query, constant, datasource, custom, textbox];

      const tester = await reduxTester<{ templating: TemplatingState; location: { query: UrlQueryMap } }>({
        preloadedState: { templating: ({} as unknown) as TemplatingState, location: { query: {} } },
      })
        .givenRootReducer(getTemplatingAndLocationRootReducer())
        .whenActionIsDispatched(initDashboardTemplating(list))
        .whenAsyncActionIsDispatched(processVariables(), true);

      tester.thenDispatchedActionPredicateShouldEqual(dispatchedActions => {
        expect(dispatchedActions.length).toEqual(8);

        expect(dispatchedActions[0]).toEqual(
          resolveInitLock(toVariablePayload({ ...query, uuid: dispatchedActions[0].payload.uuid }))
        );
        expect(dispatchedActions[1]).toEqual(
          resolveInitLock(toVariablePayload({ ...constant, uuid: dispatchedActions[1].payload.uuid }))
        );
        expect(dispatchedActions[2]).toEqual(
          resolveInitLock(toVariablePayload({ ...custom, uuid: dispatchedActions[2].payload.uuid }))
        );
        expect(dispatchedActions[3]).toEqual(
          resolveInitLock(toVariablePayload({ ...textbox, uuid: dispatchedActions[3].payload.uuid }))
        );

        expect(dispatchedActions[4]).toEqual(
          removeInitLock(toVariablePayload({ ...query, uuid: dispatchedActions[4].payload.uuid }))
        );
        expect(dispatchedActions[5]).toEqual(
          removeInitLock(toVariablePayload({ ...constant, uuid: dispatchedActions[5].payload.uuid }))
        );
        expect(dispatchedActions[6]).toEqual(
          removeInitLock(toVariablePayload({ ...custom, uuid: dispatchedActions[6].payload.uuid }))
        );
        expect(dispatchedActions[7]).toEqual(
          removeInitLock(toVariablePayload({ ...textbox, uuid: dispatchedActions[7].payload.uuid }))
        );

        return true;
      });
    });
  });

  describe('when setOptionFromUrl is dispatched with a custom variable (no refresh property)', () => {
    it.each`
      urlValue      | expected
      ${'B'}        | ${['B']}
      ${['B']}      | ${['B']}
      ${'X'}        | ${['X']}
      ${''}         | ${['']}
      ${['A', 'B']} | ${['A', 'B']}
      ${null}       | ${[null]}
      ${undefined}  | ${[undefined]}
    `('and urlValue is $urlValue then correct actions are dispatched', async ({ urlValue, expected }) => {
      const custom = variableMockBuilder('custom')
        .withUuid('0')
        .withOptions('A', 'B', 'C')
        .withCurrent('A')
        .create();

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
        .whenAsyncActionIsDispatched(setOptionFromUrl(toVariableIdentifier(custom), urlValue), true);

      tester.thenDispatchedActionShouldEqual(
        setCurrentVariableValue(
          toVariablePayload(
            { type: 'custom', uuid: '0' },
            { option: { text: expected, value: expected, selected: false } }
          )
        )
      );
    });
  });
});

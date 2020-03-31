import { AnyAction } from 'redux';
import { UrlQueryMap } from '@grafana/runtime';

import { getTemplatingAndLocationRootReducer, getTemplatingRootReducer } from './helpers';
import { variableAdapters } from '../adapters';
import { createQueryVariableAdapter } from '../query/adapter';
import { createCustomVariableAdapter } from '../custom/adapter';
import { createTextBoxVariableAdapter } from '../textbox/adapter';
import { createConstantVariableAdapter } from '../constant/adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from 'app/features/variables/state/reducers';
import { initDashboardTemplating, processVariables, setOptionFromUrl, validateVariableSelectionState } from './actions';
import {
  addInitLock,
  addVariable,
  removeInitLock,
  removeVariable,
  resolveInitLock,
  setCurrentVariableValue,
} from './sharedReducer';
import { NEW_VARIABLE_ID, toVariableIdentifier, toVariablePayload } from './types';
import {
  constantBuilder,
  customBuilder,
  datasourceBuilder,
  queryBuilder,
  textboxBuilder,
} from '../shared/testing/builders';
import { changeVariableName } from '../editor/actions';
import { changeVariableNameFailed, changeVariableNameSucceeded, setIdInEditor } from '../editor/reducer';

variableAdapters.setInit(() => [
  createQueryVariableAdapter(),
  createCustomVariableAdapter(),
  createTextBoxVariableAdapter(),
  createConstantVariableAdapter(),
]);

describe('shared actions', () => {
  describe('when initDashboardTemplating is dispatched', () => {
    it('then correct actions are dispatched', () => {
      const query = queryBuilder().build();
      const constant = constantBuilder().build();
      const datasource = datasourceBuilder().build();
      const custom = customBuilder().build();
      const textbox = textboxBuilder().build();
      const list = [query, constant, datasource, custom, textbox];

      reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating(list))
        .thenDispatchedActionsPredicateShouldEqual(dispatchedActions => {
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
            addInitLock(toVariablePayload({ ...query, id: dispatchedActions[4].payload.id }))
          );
          expect(dispatchedActions[5]).toEqual(
            addInitLock(toVariablePayload({ ...constant, id: dispatchedActions[5].payload.id }))
          );
          expect(dispatchedActions[6]).toEqual(
            addInitLock(toVariablePayload({ ...custom, id: dispatchedActions[6].payload.id }))
          );
          expect(dispatchedActions[7]).toEqual(
            addInitLock(toVariablePayload({ ...textbox, id: dispatchedActions[7].payload.id }))
          );

          return true;
        });
    });
  });

  describe('when processVariables is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const query = queryBuilder().build();
      const constant = constantBuilder().build();
      const datasource = datasourceBuilder().build();
      const custom = customBuilder().build();
      const textbox = textboxBuilder().build();
      const list = [query, constant, datasource, custom, textbox];

      const tester = await reduxTester<{ templating: TemplatingState; location: { query: UrlQueryMap } }>({
        preloadedState: { templating: ({} as unknown) as TemplatingState, location: { query: {} } },
      })
        .givenRootReducer(getTemplatingAndLocationRootReducer())
        .whenActionIsDispatched(initDashboardTemplating(list))
        .whenAsyncActionIsDispatched(processVariables(), true);

      await tester.thenDispatchedActionsPredicateShouldEqual(dispatchedActions => {
        expect(dispatchedActions.length).toEqual(8);

        expect(dispatchedActions[0]).toEqual(
          resolveInitLock(toVariablePayload({ ...query, id: dispatchedActions[0].payload.id }))
        );
        expect(dispatchedActions[1]).toEqual(
          resolveInitLock(toVariablePayload({ ...constant, id: dispatchedActions[1].payload.id }))
        );
        expect(dispatchedActions[2]).toEqual(
          resolveInitLock(toVariablePayload({ ...custom, id: dispatchedActions[2].payload.id }))
        );
        expect(dispatchedActions[3]).toEqual(
          resolveInitLock(toVariablePayload({ ...textbox, id: dispatchedActions[3].payload.id }))
        );

        expect(dispatchedActions[4]).toEqual(
          removeInitLock(toVariablePayload({ ...query, id: dispatchedActions[4].payload.id }))
        );
        expect(dispatchedActions[5]).toEqual(
          removeInitLock(toVariablePayload({ ...constant, id: dispatchedActions[5].payload.id }))
        );
        expect(dispatchedActions[6]).toEqual(
          removeInitLock(toVariablePayload({ ...custom, id: dispatchedActions[6].payload.id }))
        );
        expect(dispatchedActions[7]).toEqual(
          removeInitLock(toVariablePayload({ ...textbox, id: dispatchedActions[7].payload.id }))
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
      const custom = customBuilder()
        .withId('0')
        .withOptions('A', 'B', 'C')
        .withCurrent('A')
        .build();

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
        .whenAsyncActionIsDispatched(setOptionFromUrl(toVariableIdentifier(custom), urlValue), true);

      await tester.thenDispatchedActionsShouldEqual(
        setCurrentVariableValue(
          toVariablePayload(
            { type: 'custom', id: '0' },
            { option: { text: expected, value: expected, selected: false } }
          )
        )
      );
    });
  });

  describe('when validateVariableSelectionState is dispatched with a custom variable (no dependencies)', () => {
    describe('and not multivalue', () => {
      it.each`
        withOptions        | withCurrent  | defaultValue | expected
        ${['A', 'B', 'C']} | ${undefined} | ${undefined} | ${'A'}
        ${['A', 'B', 'C']} | ${'B'}       | ${undefined} | ${'B'}
        ${['A', 'B', 'C']} | ${'B'}       | ${'C'}       | ${'B'}
        ${['A', 'B', 'C']} | ${'X'}       | ${undefined} | ${'A'}
        ${['A', 'B', 'C']} | ${'X'}       | ${'C'}       | ${'C'}
        ${undefined}       | ${'B'}       | ${undefined} | ${'A'}
      `('then correct actions are dispatched', async ({ withOptions, withCurrent, defaultValue, expected }) => {
        let custom;

        if (!withOptions) {
          custom = customBuilder()
            .withId('0')
            .withCurrent(withCurrent)
            .withoutOptions()
            .build();
        } else {
          custom = customBuilder()
            .withId('0')
            .withOptions(...withOptions)
            .withCurrent(withCurrent)
            .build();
        }

        const tester = await reduxTester<{ templating: TemplatingState }>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
          .whenAsyncActionIsDispatched(
            validateVariableSelectionState(toVariableIdentifier(custom), defaultValue),
            true
          );

        await tester.thenDispatchedActionsPredicateShouldEqual(dispatchedActions => {
          const expectedActions: AnyAction[] = !withOptions
            ? []
            : [
                setCurrentVariableValue(
                  toVariablePayload(
                    { type: 'custom', id: '0' },
                    { option: { text: expected, value: expected, selected: false } }
                  )
                ),
              ];
          expect(dispatchedActions).toEqual(expectedActions);
          return true;
        });
      });
    });

    describe('and multivalue', () => {
      it.each`
        withOptions        | withCurrent   | defaultValue | expectedText  | expectedSelected
        ${['A', 'B', 'C']} | ${['B']}      | ${undefined} | ${['B']}      | ${true}
        ${['A', 'B', 'C']} | ${['B']}      | ${'C'}       | ${['B']}      | ${true}
        ${['A', 'B', 'C']} | ${['B', 'C']} | ${undefined} | ${['B', 'C']} | ${true}
        ${['A', 'B', 'C']} | ${['B', 'C']} | ${'C'}       | ${['B', 'C']} | ${true}
        ${['A', 'B', 'C']} | ${['X']}      | ${undefined} | ${'A'}        | ${false}
        ${['A', 'B', 'C']} | ${['X']}      | ${'C'}       | ${'A'}        | ${false}
      `(
        'then correct actions are dispatched',
        async ({ withOptions, withCurrent, defaultValue, expectedText, expectedSelected }) => {
          let custom;

          if (!withOptions) {
            custom = customBuilder()
              .withId('0')
              .withMulti()
              .withCurrent(withCurrent)
              .withoutOptions()
              .build();
          } else {
            custom = customBuilder()
              .withId('0')
              .withMulti()
              .withOptions(...withOptions)
              .withCurrent(withCurrent)
              .build();
          }

          const tester = await reduxTester<{ templating: TemplatingState }>()
            .givenRootReducer(getTemplatingRootReducer())
            .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
            .whenAsyncActionIsDispatched(
              validateVariableSelectionState(toVariableIdentifier(custom), defaultValue),
              true
            );

          await tester.thenDispatchedActionsPredicateShouldEqual(dispatchedActions => {
            const expectedActions: AnyAction[] = !withOptions
              ? []
              : [
                  setCurrentVariableValue(
                    toVariablePayload(
                      { type: 'custom', id: '0' },
                      { option: { text: expectedText, value: expectedText, selected: expectedSelected } }
                    )
                  ),
                ];
            expect(dispatchedActions).toEqual(expectedActions);
            return true;
          });
        }
      );
    });
  });

  describe('changeVariableName', () => {
    describe('when changeVariableName is dispatched with the same name', () => {
      it('then no actions are dispatched', () => {
        const textbox = textboxBuilder()
          .withId('textbox')
          .withName('textbox')
          .build();
        const constant = constantBuilder()
          .withId('constant')
          .withName('constant')
          .build();

        reduxTester<{ templating: TemplatingState }>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(addVariable(toVariablePayload(textbox, { global: false, index: 0, model: textbox })))
          .whenActionIsDispatched(
            addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant }))
          )
          .whenActionIsDispatched(changeVariableName(toVariableIdentifier(constant), constant.name), true)
          .thenNoActionsWhereDispatched();
      });
    });

    describe('when changeVariableName is dispatched with an unique name', () => {
      it('then the correct actions are dispatched', () => {
        const textbox = textboxBuilder()
          .withId('textbox')
          .withName('textbox')
          .build();
        const constant = constantBuilder()
          .withId('constant')
          .withName('constant')
          .build();

        reduxTester<{ templating: TemplatingState }>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(addVariable(toVariablePayload(textbox, { global: false, index: 0, model: textbox })))
          .whenActionIsDispatched(
            addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant }))
          )
          .whenActionIsDispatched(changeVariableName(toVariableIdentifier(constant), 'constant1'), true)
          .thenDispatchedActionsShouldEqual(
            addVariable({
              type: 'constant',
              id: 'constant1',
              data: {
                global: false,
                index: 1,
                model: { ...constant, name: 'constant1', id: 'constant1', global: false, index: 1 },
              },
            }),
            changeVariableNameSucceeded({ type: 'constant', id: 'constant1', data: { newName: 'constant1' } }),
            setIdInEditor({ id: 'constant1' }),
            removeVariable({ type: 'constant', id: 'constant', data: { reIndex: false } })
          );
      });
    });

    describe('when changeVariableName is dispatched with an unique name for a new variable', () => {
      it('then the correct actions are dispatched', () => {
        const textbox = textboxBuilder()
          .withId('textbox')
          .withName('textbox')
          .build();
        const constant = constantBuilder()
          .withId(NEW_VARIABLE_ID)
          .withName('constant')
          .build();

        reduxTester<{ templating: TemplatingState }>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(addVariable(toVariablePayload(textbox, { global: false, index: 0, model: textbox })))
          .whenActionIsDispatched(
            addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant }))
          )
          .whenActionIsDispatched(changeVariableName(toVariableIdentifier(constant), 'constant1'), true)
          .thenDispatchedActionsShouldEqual(
            changeVariableNameSucceeded({ type: 'constant', id: NEW_VARIABLE_ID, data: { newName: 'constant1' } })
          );
      });
    });

    describe('when changeVariableName is dispatched with __newName', () => {
      it('then the correct actions are dispatched', () => {
        const textbox = textboxBuilder()
          .withId('textbox')
          .withName('textbox')
          .build();
        const constant = constantBuilder()
          .withId('constant')
          .withName('constant')
          .build();

        reduxTester<{ templating: TemplatingState }>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(addVariable(toVariablePayload(textbox, { global: false, index: 0, model: textbox })))
          .whenActionIsDispatched(
            addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant }))
          )
          .whenActionIsDispatched(changeVariableName(toVariableIdentifier(constant), '__newName'), true)
          .thenDispatchedActionsShouldEqual(
            changeVariableNameFailed({
              newName: '__newName',
              errorText: "Template names cannot begin with '__', that's reserved for Grafana's global variables",
            })
          );
      });
    });

    describe('when changeVariableName is dispatched with illegal characters', () => {
      it('then the correct actions are dispatched', () => {
        const textbox = textboxBuilder()
          .withId('textbox')
          .withName('textbox')
          .build();
        const constant = constantBuilder()
          .withId('constant')
          .withName('constant')
          .build();

        reduxTester<{ templating: TemplatingState }>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(addVariable(toVariablePayload(textbox, { global: false, index: 0, model: textbox })))
          .whenActionIsDispatched(
            addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant }))
          )
          .whenActionIsDispatched(changeVariableName(toVariableIdentifier(constant), '#constant!'), true)
          .thenDispatchedActionsShouldEqual(
            changeVariableNameFailed({
              newName: '#constant!',
              errorText: 'Only word and digit characters are allowed in variable names',
            })
          );
      });
    });

    describe('when changeVariableName is dispatched with a name that is already used', () => {
      it('then the correct actions are dispatched', () => {
        const textbox = textboxBuilder()
          .withId('textbox')
          .withName('textbox')
          .build();
        const constant = constantBuilder()
          .withId('constant')
          .withName('constant')
          .build();

        reduxTester<{ templating: TemplatingState }>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(addVariable(toVariablePayload(textbox, { global: false, index: 0, model: textbox })))
          .whenActionIsDispatched(
            addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant }))
          )
          .whenActionIsDispatched(changeVariableName(toVariableIdentifier(constant), 'textbox'), true)
          .thenDispatchedActionsShouldEqual(
            changeVariableNameFailed({
              newName: 'textbox',
              errorText: 'Variable with the same name already exists',
            })
          );
      });
    });
  });
});

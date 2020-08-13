import { AnyAction } from 'redux';
import { UrlQueryMap } from '@grafana/data';

import { getRootReducer, getTemplatingAndLocationRootReducer, getTemplatingRootReducer } from './helpers';
import { variableAdapters } from '../adapters';
import { createQueryVariableAdapter } from '../query/adapter';
import { createCustomVariableAdapter } from '../custom/adapter';
import { createTextBoxVariableAdapter } from '../textbox/adapter';
import { createConstantVariableAdapter } from '../constant/adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from 'app/features/variables/state/reducers';
import {
  cancelVariables,
  changeVariableMultiValue,
  cleanUpVariables,
  initDashboardTemplating,
  initVariablesTransaction,
  processVariables,
  setOptionFromUrl,
  validateVariableSelectionState,
} from './actions';
import {
  addInitLock,
  addVariable,
  changeVariableProp,
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
import {
  changeVariableNameFailed,
  changeVariableNameSucceeded,
  initialVariableEditorState,
  setIdInEditor,
} from '../editor/reducer';
import { DashboardState, LocationState } from '../../../types';
import {
  TransactionStatus,
  variablesClearTransaction,
  variablesCompleteTransaction,
  variablesInitTransaction,
} from './transactionReducer';
import { initialState } from '../pickers/OptionsPicker/reducer';
import { cleanVariables } from './variablesReducer';
import { expect } from '../../../../test/lib/common';

variableAdapters.setInit(() => [
  createQueryVariableAdapter(),
  createCustomVariableAdapter(),
  createTextBoxVariableAdapter(),
  createConstantVariableAdapter(),
]);

jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  getTimeSrv: () => ({
    timeRange: jest.fn().mockReturnValue(undefined),
  }),
}));

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
      urlValue      | isMulti  | expected
      ${'B'}        | ${false} | ${'B'}
      ${['B']}      | ${false} | ${'B'}
      ${'X'}        | ${false} | ${'X'}
      ${''}         | ${false} | ${''}
      ${null}       | ${false} | ${null}
      ${undefined}  | ${false} | ${undefined}
      ${'B'}        | ${true}  | ${['B']}
      ${['B']}      | ${true}  | ${['B']}
      ${'X'}        | ${true}  | ${['X']}
      ${''}         | ${true}  | ${['']}
      ${['A', 'B']} | ${true}  | ${['A', 'B']}
      ${null}       | ${true}  | ${[null]}
      ${undefined}  | ${true}  | ${[undefined]}
    `('and urlValue is $urlValue then correct actions are dispatched', async ({ urlValue, expected, isMulti }) => {
      const custom = customBuilder()
        .withId('0')
        .withMulti(isMulti)
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
        ${undefined}       | ${'B'}       | ${undefined} | ${'should not dispatch setCurrentVariableValue'}
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
          .whenActionIsDispatched(changeVariableName(toVariableIdentifier(constant), constant.name), true)
          .thenDispatchedActionsShouldEqual(
            changeVariableNameSucceeded({ type: 'constant', id: 'constant', data: { newName: 'constant' } })
          );
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

  describe('changeVariableMultiValue', () => {
    describe('when changeVariableMultiValue is dispatched for variable with multi enabled', () => {
      it('then correct actions are dispatched', () => {
        const custom = customBuilder()
          .withId('custom')
          .withMulti(true)
          .withCurrent(['A'], ['A'])
          .build();

        reduxTester<{ templating: TemplatingState }>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
          .whenActionIsDispatched(changeVariableMultiValue(toVariableIdentifier(custom), false), true)
          .thenDispatchedActionsShouldEqual(
            changeVariableProp(
              toVariablePayload(custom, {
                propName: 'multi',
                propValue: false,
              })
            ),
            changeVariableProp(
              toVariablePayload(custom, {
                propName: 'current',
                propValue: {
                  value: 'A',
                  text: 'A',
                  selected: true,
                },
              })
            )
          );
      });
    });

    describe('when changeVariableMultiValue is dispatched for variable with multi disabled', () => {
      it('then correct actions are dispatched', () => {
        const custom = customBuilder()
          .withId('custom')
          .withMulti(false)
          .withCurrent(['A'], ['A'])
          .build();

        reduxTester<{ templating: TemplatingState }>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
          .whenActionIsDispatched(changeVariableMultiValue(toVariableIdentifier(custom), true), true)
          .thenDispatchedActionsShouldEqual(
            changeVariableProp(
              toVariablePayload(custom, {
                propName: 'multi',
                propValue: true,
              })
            ),
            changeVariableProp(
              toVariablePayload(custom, {
                propName: 'current',
                propValue: {
                  value: ['A'],
                  text: ['A'],
                  selected: true,
                },
              })
            )
          );
      });
    });
  });

  describe('initVariablesTransaction', () => {
    type ReducersUsedInContext = {
      templating: TemplatingState;
      dashboard: DashboardState;
      location: LocationState;
    };
    const constant = constantBuilder()
      .withId('constant')
      .withName('constant')
      .build();
    const templating: any = { list: [constant] };
    const uid = 'uid';
    const dashboard: any = { title: 'Some dash', uid, templating };

    describe('when called and the previous dashboard has completed', () => {
      it('then correct actions are dispatched', async () => {
        const tester = await reduxTester<ReducersUsedInContext>()
          .givenRootReducer(getRootReducer())
          .whenAsyncActionIsDispatched(initVariablesTransaction(uid, dashboard));

        tester.thenDispatchedActionsPredicateShouldEqual(dispatchedActions => {
          expect(dispatchedActions[0]).toEqual(variablesInitTransaction({ uid }));
          expect(dispatchedActions[1].type).toEqual(addVariable.type);
          expect(dispatchedActions[1].payload.id).toEqual('__dashboard');
          expect(dispatchedActions[2].type).toEqual(addVariable.type);
          expect(dispatchedActions[2].payload.id).toEqual('__org');
          expect(dispatchedActions[3].type).toEqual(addVariable.type);
          expect(dispatchedActions[3].payload.id).toEqual('__user');
          expect(dispatchedActions[4]).toEqual(
            addVariable(toVariablePayload(constant, { global: false, index: 0, model: constant }))
          );
          expect(dispatchedActions[5]).toEqual(addInitLock(toVariablePayload(constant)));
          expect(dispatchedActions[6]).toEqual(resolveInitLock(toVariablePayload(constant)));
          expect(dispatchedActions[7]).toEqual(removeInitLock(toVariablePayload(constant)));

          expect(dispatchedActions[8]).toEqual(variablesCompleteTransaction({ uid }));
          return dispatchedActions.length === 9;
        });
      });
    });

    describe('when called and the previous dashboard is still processing variables', () => {
      it('then correct actions are dispatched', async () => {
        const transactionState = { uid: 'previous-uid', status: TransactionStatus.Fetching };

        const tester = await reduxTester<ReducersUsedInContext>({
          preloadedState: ({
            templating: {
              transaction: transactionState,
              variables: {},
              optionsPicker: { ...initialState },
              editor: { ...initialVariableEditorState },
            },
          } as unknown) as ReducersUsedInContext,
        })
          .givenRootReducer(getRootReducer())
          .whenAsyncActionIsDispatched(initVariablesTransaction(uid, dashboard));

        tester.thenDispatchedActionsPredicateShouldEqual(dispatchedActions => {
          expect(dispatchedActions[0]).toEqual(cleanVariables());
          expect(dispatchedActions[1]).toEqual(variablesClearTransaction());
          expect(dispatchedActions[2]).toEqual(variablesInitTransaction({ uid }));
          expect(dispatchedActions[3].type).toEqual(addVariable.type);
          expect(dispatchedActions[3].payload.id).toEqual('__dashboard');
          expect(dispatchedActions[4].type).toEqual(addVariable.type);
          expect(dispatchedActions[4].payload.id).toEqual('__org');
          expect(dispatchedActions[5].type).toEqual(addVariable.type);
          expect(dispatchedActions[5].payload.id).toEqual('__user');
          expect(dispatchedActions[6]).toEqual(
            addVariable(toVariablePayload(constant, { global: false, index: 0, model: constant }))
          );
          expect(dispatchedActions[7]).toEqual(addInitLock(toVariablePayload(constant)));
          expect(dispatchedActions[8]).toEqual(resolveInitLock(toVariablePayload(constant)));
          expect(dispatchedActions[9]).toEqual(removeInitLock(toVariablePayload(constant)));
          expect(dispatchedActions[10]).toEqual(variablesCompleteTransaction({ uid }));
          return dispatchedActions.length === 11;
        });
      });
    });
  });

  describe('cleanUpVariables', () => {
    describe('when called', () => {
      it('then correct actions are dispatched', async () => {
        reduxTester<{ templating: TemplatingState }>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(cleanUpVariables())
          .thenDispatchedActionsShouldEqual(cleanVariables(), variablesClearTransaction());
      });
    });
  });

  describe('cancelVariables', () => {
    const cancelAllInFlightRequestsMock = jest.fn();
    const backendSrvMock: any = {
      cancelAllInFlightRequests: cancelAllInFlightRequestsMock,
    };

    describe('when called', () => {
      it('then cancelAllInFlightRequests should be called and correct actions are dispatched', async () => {
        reduxTester<{ templating: TemplatingState }>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(cancelVariables({ getBackendSrv: () => backendSrvMock }))
          .thenDispatchedActionsShouldEqual(cleanVariables(), variablesClearTransaction());

        expect(cancelAllInFlightRequestsMock).toHaveBeenCalledTimes(1);
      });
    });
  });
});

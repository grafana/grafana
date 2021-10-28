import { AnyAction } from 'redux';

import { getRootReducer, getTemplatingRootReducer, RootReducerType, TemplatingReducerType } from './helpers';
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
  fixSelectedInconsistency,
  initDashboardTemplating,
  initVariablesTransaction,
  isVariableUrlValueDifferentFromCurrent,
  processVariables,
  validateVariableSelectionState,
} from './actions';
import {
  addVariable,
  changeVariableProp,
  removeVariable,
  setCurrentVariableValue,
  variableStateCompleted,
  variableStateFetching,
  variableStateNotStarted,
} from './sharedReducer';
import {
  ALL_VARIABLE_TEXT,
  ALL_VARIABLE_VALUE,
  NEW_VARIABLE_ID,
  toVariableIdentifier,
  toVariablePayload,
} from './types';
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
  cleanEditorState,
  initialVariableEditorState,
  setIdInEditor,
} from '../editor/reducer';
import {
  TransactionStatus,
  variablesClearTransaction,
  variablesCompleteTransaction,
  variablesInitTransaction,
} from './transactionReducer';
import { cleanPickerState, initialState } from '../pickers/OptionsPicker/reducer';
import { cleanVariables } from './variablesReducer';
import { expect } from '../../../../test/lib/common';
import { ConstantVariableModel, VariableRefresh } from '../types';
import { updateVariableOptions } from '../query/reducer';
import { setVariableQueryRunner, VariableQueryRunner } from '../query/VariableQueryRunner';
import * as runtime from '@grafana/runtime';
import { LoadingState } from '@grafana/data';
import { toAsyncOfResult } from '../../query/state/DashboardQueryRunner/testHelpers';

variableAdapters.setInit(() => [
  createQueryVariableAdapter(),
  createCustomVariableAdapter(),
  createTextBoxVariableAdapter(),
  createConstantVariableAdapter(),
]);

const metricFindQuery = jest
  .fn()
  .mockResolvedValueOnce([{ text: 'responses' }, { text: 'timers' }])
  .mockResolvedValue([{ text: '200' }, { text: '500' }]);
const getMetricSources = jest.fn().mockReturnValue([]);
const getDatasource = jest.fn().mockResolvedValue({ metricFindQuery });

jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  getTimeSrv: () => ({
    timeRange: jest.fn().mockReturnValue(undefined),
  }),
}));

runtime.setDataSourceSrv({
  get: getDatasource,
  getList: getMetricSources,
} as any);

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
        .thenDispatchedActionsPredicateShouldEqual((dispatchedActions) => {
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
            variableStateNotStarted(toVariablePayload({ ...query, id: dispatchedActions[4].payload.id }))
          );
          expect(dispatchedActions[5]).toEqual(
            variableStateNotStarted(toVariablePayload({ ...constant, id: dispatchedActions[5].payload.id }))
          );
          expect(dispatchedActions[6]).toEqual(
            variableStateNotStarted(toVariablePayload({ ...custom, id: dispatchedActions[6].payload.id }))
          );
          expect(dispatchedActions[7]).toEqual(
            variableStateNotStarted(toVariablePayload({ ...textbox, id: dispatchedActions[7].payload.id }))
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
      const preloadedState = {
        templating: ({} as unknown) as TemplatingState,
      };
      const locationService: any = { getSearchObject: () => ({}) };
      runtime.setLocationService(locationService);
      const variableQueryRunner: any = {
        cancelRequest: jest.fn(),
        queueRequest: jest.fn(),
        getResponse: () => toAsyncOfResult({ state: LoadingState.Done, identifier: toVariableIdentifier(query) }),
        destroy: jest.fn(),
      };
      setVariableQueryRunner(variableQueryRunner);

      const tester = await reduxTester<TemplatingReducerType>({ preloadedState })
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(variablesInitTransaction({ uid: '' }))
        .whenActionIsDispatched(initDashboardTemplating(list))
        .whenAsyncActionIsDispatched(processVariables(), true);

      await tester.thenDispatchedActionsPredicateShouldEqual((dispatchedActions) => {
        expect(dispatchedActions.length).toEqual(5);

        expect(dispatchedActions[0]).toEqual(
          variableStateFetching(toVariablePayload({ ...query, id: dispatchedActions[0].payload.id }))
        );

        expect(dispatchedActions[1]).toEqual(
          variableStateCompleted(toVariablePayload({ ...constant, id: dispatchedActions[1].payload.id }))
        );

        expect(dispatchedActions[2]).toEqual(
          variableStateCompleted(toVariablePayload({ ...custom, id: dispatchedActions[2].payload.id }))
        );

        expect(dispatchedActions[3]).toEqual(
          variableStateCompleted(toVariablePayload({ ...textbox, id: dispatchedActions[3].payload.id }))
        );

        expect(dispatchedActions[4]).toEqual(
          variableStateCompleted(toVariablePayload({ ...query, id: dispatchedActions[4].payload.id }))
        );

        return true;
      });
    });

    // Fix for https://github.com/grafana/grafana/issues/28791
    it('fix for https://github.com/grafana/grafana/issues/28791', async () => {
      setVariableQueryRunner(new VariableQueryRunner());
      const stats = queryBuilder()
        .withId('stats')
        .withName('stats')
        .withQuery('stats.*')
        .withRefresh(VariableRefresh.onDashboardLoad)
        .withCurrent(['response'], ['response'])
        .withMulti()
        .withIncludeAll()
        .build();

      const substats = queryBuilder()
        .withId('substats')
        .withName('substats')
        .withQuery('stats.$stats.*')
        .withRefresh(VariableRefresh.onDashboardLoad)
        .withCurrent([ALL_VARIABLE_TEXT], [ALL_VARIABLE_VALUE])
        .withMulti()
        .withIncludeAll()
        .build();

      const list = [stats, substats];
      const query = { orgId: '1', 'var-stats': 'response', 'var-substats': ALL_VARIABLE_TEXT };
      const locationService: any = { getSearchObject: () => query };
      runtime.setLocationService(locationService);
      const preloadedState = {
        templating: ({} as unknown) as TemplatingState,
      };

      const tester = await reduxTester<TemplatingReducerType>({ preloadedState })
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(variablesInitTransaction({ uid: '' }))
        .whenActionIsDispatched(initDashboardTemplating(list))
        .whenAsyncActionIsDispatched(processVariables(), true);

      await tester.thenDispatchedActionsShouldEqual(
        variableStateFetching(toVariablePayload(stats)),
        updateVariableOptions(
          toVariablePayload(stats, { results: [{ text: 'responses' }, { text: 'timers' }], templatedRegex: '' })
        ),
        setCurrentVariableValue(
          toVariablePayload(stats, { option: { text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false } })
        ),
        variableStateCompleted(toVariablePayload(stats)),
        setCurrentVariableValue(
          toVariablePayload(stats, { option: { text: ['response'], value: ['response'], selected: false } })
        ),
        variableStateFetching(toVariablePayload(substats)),
        updateVariableOptions(
          toVariablePayload(substats, { results: [{ text: '200' }, { text: '500' }], templatedRegex: '' })
        ),
        setCurrentVariableValue(
          toVariablePayload(substats, {
            option: { text: [ALL_VARIABLE_TEXT], value: [ALL_VARIABLE_VALUE], selected: true },
          })
        ),
        variableStateCompleted(toVariablePayload(substats)),
        setCurrentVariableValue(
          toVariablePayload(substats, {
            option: { text: [ALL_VARIABLE_TEXT], value: [ALL_VARIABLE_VALUE], selected: false },
          })
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
          custom = customBuilder().withId('0').withCurrent(withCurrent).withoutOptions().build();
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

        await tester.thenDispatchedActionsPredicateShouldEqual((dispatchedActions) => {
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
            custom = customBuilder().withId('0').withMulti().withCurrent(withCurrent).withoutOptions().build();
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

          await tester.thenDispatchedActionsPredicateShouldEqual((dispatchedActions) => {
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
        const textbox = textboxBuilder().withId('textbox').withName('textbox').build();
        const constant = constantBuilder().withId('constant').withName('constant').build();

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
        const textbox = textboxBuilder().withId('textbox').withName('textbox').build();
        const constant = constantBuilder().withId('constant').withName('constant').build();

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
                model: {
                  ...constant,
                  name: 'constant1',
                  id: 'constant1',
                  global: false,
                  index: 1,
                  current: { selected: true, text: '', value: '' },
                  options: [{ selected: true, text: '', value: '' }],
                } as ConstantVariableModel,
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
        const textbox = textboxBuilder().withId('textbox').withName('textbox').build();
        const constant = constantBuilder().withId(NEW_VARIABLE_ID).withName('constant').build();

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
                model: {
                  ...constant,
                  name: 'constant1',
                  id: 'constant1',
                  global: false,
                  index: 1,
                  current: { selected: true, text: '', value: '' },
                  options: [{ selected: true, text: '', value: '' }],
                } as ConstantVariableModel,
              },
            }),
            changeVariableNameSucceeded({ type: 'constant', id: 'constant1', data: { newName: 'constant1' } }),
            setIdInEditor({ id: 'constant1' }),
            removeVariable({ type: 'constant', id: NEW_VARIABLE_ID, data: { reIndex: false } })
          );
      });
    });

    describe('when changeVariableName is dispatched with __newName', () => {
      it('then the correct actions are dispatched', () => {
        const textbox = textboxBuilder().withId('textbox').withName('textbox').build();
        const constant = constantBuilder().withId('constant').withName('constant').build();

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
        const textbox = textboxBuilder().withId('textbox').withName('textbox').build();
        const constant = constantBuilder().withId('constant').withName('constant').build();

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
        const textbox = textboxBuilder().withId('textbox').withName('textbox').build();
        const constant = constantBuilder().withId('constant').withName('constant').build();

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
        const custom = customBuilder().withId('custom').withMulti(true).withCurrent(['A'], ['A']).build();

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
        const custom = customBuilder().withId('custom').withMulti(false).withCurrent(['A'], ['A']).build();

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
    function getTestContext() {
      const reportSpy = jest.spyOn(runtime, 'reportInteraction').mockReturnValue(undefined);
      const constant = constantBuilder().withId('constant').withName('constant').build();
      const templating: any = { list: [constant] };
      const uid = 'uid';
      const dashboard: any = { title: 'Some dash', uid, templating };

      return { reportSpy, constant, templating, uid, dashboard };
    }

    describe('when called and the previous dashboard has completed', () => {
      it('then correct actions are dispatched', async () => {
        const { constant, uid, dashboard } = getTestContext();
        const tester = await reduxTester<RootReducerType>()
          .givenRootReducer(getRootReducer())
          .whenAsyncActionIsDispatched(initVariablesTransaction(uid, dashboard));

        tester.thenDispatchedActionsPredicateShouldEqual((dispatchedActions) => {
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
          expect(dispatchedActions[5]).toEqual(variableStateNotStarted(toVariablePayload(constant)));
          expect(dispatchedActions[6]).toEqual(variableStateCompleted(toVariablePayload(constant)));

          expect(dispatchedActions[7]).toEqual(variablesCompleteTransaction({ uid }));
          return dispatchedActions.length === 8;
        });
      });
    });

    describe('when called and the previous dashboard is still processing variables', () => {
      it('then correct actions are dispatched', async () => {
        const { constant, uid, dashboard } = getTestContext();
        const transactionState = { uid: 'previous-uid', status: TransactionStatus.Fetching };

        const tester = await reduxTester<RootReducerType>({
          preloadedState: ({
            templating: {
              transaction: transactionState,
              variables: {},
              optionsPicker: { ...initialState },
              editor: { ...initialVariableEditorState },
            },
          } as unknown) as RootReducerType,
        })
          .givenRootReducer(getRootReducer())
          .whenAsyncActionIsDispatched(initVariablesTransaction(uid, dashboard));

        tester.thenDispatchedActionsPredicateShouldEqual((dispatchedActions) => {
          expect(dispatchedActions[0]).toEqual(cleanVariables());
          expect(dispatchedActions[1]).toEqual(cleanEditorState());
          expect(dispatchedActions[2]).toEqual(cleanPickerState());
          expect(dispatchedActions[3]).toEqual(variablesClearTransaction());
          expect(dispatchedActions[4]).toEqual(variablesInitTransaction({ uid }));
          expect(dispatchedActions[5].type).toEqual(addVariable.type);
          expect(dispatchedActions[5].payload.id).toEqual('__dashboard');
          expect(dispatchedActions[6].type).toEqual(addVariable.type);
          expect(dispatchedActions[6].payload.id).toEqual('__org');
          expect(dispatchedActions[7].type).toEqual(addVariable.type);
          expect(dispatchedActions[7].payload.id).toEqual('__user');
          expect(dispatchedActions[8]).toEqual(
            addVariable(toVariablePayload(constant, { global: false, index: 0, model: constant }))
          );
          expect(dispatchedActions[9]).toEqual(variableStateNotStarted(toVariablePayload(constant)));
          expect(dispatchedActions[10]).toEqual(variableStateCompleted(toVariablePayload(constant)));
          expect(dispatchedActions[11]).toEqual(variablesCompleteTransaction({ uid }));
          return dispatchedActions.length === 12;
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
          .thenDispatchedActionsShouldEqual(
            cleanVariables(),
            cleanEditorState(),
            cleanPickerState(),
            variablesClearTransaction()
          );
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
          .thenDispatchedActionsShouldEqual(
            cleanVariables(),
            cleanEditorState(),
            cleanPickerState(),
            variablesClearTransaction()
          );

        expect(cancelAllInFlightRequestsMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('fixSelectedInconsistency', () => {
    describe('when called for a single value variable', () => {
      describe('and there is an inconsistency between current and selected in options', () => {
        it('then it should set the correct selected', () => {
          const variable = customBuilder().withId('custom').withCurrent('A').withOptions('A', 'B', 'C').build();
          variable.options[1].selected = true;

          expect(variable.options).toEqual([
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: true },
            { text: 'C', value: 'C', selected: false },
          ]);

          fixSelectedInconsistency(variable);

          expect(variable.options).toEqual([
            { text: 'A', value: 'A', selected: true },
            { text: 'B', value: 'B', selected: false },
            { text: 'C', value: 'C', selected: false },
          ]);
        });
      });

      describe('and there is no matching option in options', () => {
        it('then the first option should be selected', () => {
          const variable = customBuilder().withId('custom').withCurrent('A').withOptions('X', 'Y', 'Z').build();

          expect(variable.options).toEqual([
            { text: 'X', value: 'X', selected: false },
            { text: 'Y', value: 'Y', selected: false },
            { text: 'Z', value: 'Z', selected: false },
          ]);

          fixSelectedInconsistency(variable);

          expect(variable.options).toEqual([
            { text: 'X', value: 'X', selected: true },
            { text: 'Y', value: 'Y', selected: false },
            { text: 'Z', value: 'Z', selected: false },
          ]);
        });
      });
    });

    describe('when called for a multi value variable', () => {
      describe('and there is an inconsistency between current and selected in options', () => {
        it('then it should set the correct selected', () => {
          const variable = customBuilder().withId('custom').withCurrent(['A', 'C']).withOptions('A', 'B', 'C').build();
          variable.options[1].selected = true;

          expect(variable.options).toEqual([
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: true },
            { text: 'C', value: 'C', selected: false },
          ]);

          fixSelectedInconsistency(variable);

          expect(variable.options).toEqual([
            { text: 'A', value: 'A', selected: true },
            { text: 'B', value: 'B', selected: false },
            { text: 'C', value: 'C', selected: true },
          ]);
        });
      });

      describe('and there is no matching option in options', () => {
        it('then the first option should be selected', () => {
          const variable = customBuilder().withId('custom').withCurrent(['A', 'C']).withOptions('X', 'Y', 'Z').build();

          expect(variable.options).toEqual([
            { text: 'X', value: 'X', selected: false },
            { text: 'Y', value: 'Y', selected: false },
            { text: 'Z', value: 'Z', selected: false },
          ]);

          fixSelectedInconsistency(variable);

          expect(variable.options).toEqual([
            { text: 'X', value: 'X', selected: true },
            { text: 'Y', value: 'Y', selected: false },
            { text: 'Z', value: 'Z', selected: false },
          ]);
        });
      });
    });
  });

  describe('isVariableUrlValueDifferentFromCurrent', () => {
    describe('when called with a single valued variable', () => {
      describe('and values are equal', () => {
        it('then it should return false', () => {
          const variable = queryBuilder().withMulti(false).withCurrent('A', 'A').build();
          const urlValue = 'A';

          expect(isVariableUrlValueDifferentFromCurrent(variable, urlValue)).toBe(false);
        });
      });

      describe('and values are different', () => {
        it('then it should return true', () => {
          const variable = queryBuilder().withMulti(false).withCurrent('A', 'A').build();
          const urlValue = 'B';

          expect(isVariableUrlValueDifferentFromCurrent(variable, urlValue)).toBe(true);
        });
      });
    });

    describe('when called with a multi valued variable', () => {
      describe('and values are equal', () => {
        it('then it should return false', () => {
          const variable = queryBuilder().withMulti(true).withCurrent(['A'], ['A']).build();
          const urlValue = ['A'];

          expect(isVariableUrlValueDifferentFromCurrent(variable, urlValue)).toBe(false);
        });

        describe('but urlValue is not an array', () => {
          it('then it should return false', () => {
            const variable = queryBuilder().withMulti(true).withCurrent(['A'], ['A']).build();
            const urlValue = 'A';

            expect(isVariableUrlValueDifferentFromCurrent(variable, urlValue)).toBe(false);
          });
        });
      });

      describe('and values are different', () => {
        it('then it should return true', () => {
          const variable = queryBuilder().withMulti(true).withCurrent(['A'], ['A']).build();
          const urlValue = ['C'];

          expect(isVariableUrlValueDifferentFromCurrent(variable, urlValue)).toBe(true);
        });

        describe('but urlValue is not an array', () => {
          it('then it should return true', () => {
            const variable = queryBuilder().withMulti(true).withCurrent(['A'], ['A']).build();
            const urlValue = 'C';

            expect(isVariableUrlValueDifferentFromCurrent(variable, urlValue)).toBe(true);
          });
        });
      });
    });
  });
});

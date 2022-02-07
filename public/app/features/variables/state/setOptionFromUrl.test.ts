import { variableAdapters } from '../adapters';
import { createCustomVariableAdapter } from '../custom/adapter';
import { customBuilder } from '../shared/testing/builders';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from './reducers';
import { getTemplatingRootReducer } from './helpers';
import { addVariable, setCurrentVariableValue } from './sharedReducer';
import { toVariableIdentifier, toVariablePayload } from './types';
import { setOptionFromUrl } from './actions';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../constants';

variableAdapters.setInit(() => [createCustomVariableAdapter()]);

describe('when setOptionFromUrl is dispatched with a custom variable (no refresh property)', () => {
  it.each`
    urlValue      | isMulti  | expected
    ${'B'}        | ${false} | ${'B'}
    ${['B']}      | ${false} | ${'B'}
    ${'X'}        | ${false} | ${'X'}
    ${''}         | ${false} | ${''}
    ${null}       | ${false} | ${''}
    ${undefined}  | ${false} | ${''}
    ${'B'}        | ${true}  | ${['B']}
    ${['B']}      | ${true}  | ${['B']}
    ${'X'}        | ${true}  | ${['X']}
    ${''}         | ${true}  | ${['']}
    ${['A', 'B']} | ${true}  | ${['A', 'B']}
    ${null}       | ${true}  | ${['']}
    ${undefined}  | ${true}  | ${['']}
  `('and urlValue is $urlValue then correct actions are dispatched', async ({ urlValue, expected, isMulti }) => {
    const custom = customBuilder().withId('0').withMulti(isMulti).withOptions('A', 'B', 'C').withCurrent('A').build();

    const tester = await reduxTester<{ templating: TemplatingState }>()
      .givenRootReducer(getTemplatingRootReducer())
      .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
      .whenAsyncActionIsDispatched(setOptionFromUrl(toVariableIdentifier(custom), urlValue), true);

    await tester.thenDispatchedActionsShouldEqual(
      setCurrentVariableValue(
        toVariablePayload({ type: 'custom', id: '0' }, { option: { text: expected, value: expected, selected: false } })
      )
    );
  });
});

describe('when setOptionFromUrl is dispatched for a variable with a custom all value', () => {
  it('and urlValue contains same all value then correct actions are dispatched', async () => {
    const allValue = '.*';
    const urlValue = allValue;
    const custom = customBuilder()
      .withId('0')
      .withMulti(false)
      .withIncludeAll()
      .withAllValue(allValue)
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
          { option: { text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false } }
        )
      )
    );
  });

  it('and urlValue differs from all value then correct actions are dispatched', async () => {
    const allValue = '.*';
    const urlValue = 'X';
    const custom = customBuilder()
      .withId('0')
      .withMulti(false)
      .withIncludeAll()
      .withAllValue(allValue)
      .withOptions('A', 'B', 'C')
      .withCurrent('A')
      .build();

    const tester = await reduxTester<{ templating: TemplatingState }>()
      .givenRootReducer(getTemplatingRootReducer())
      .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
      .whenAsyncActionIsDispatched(setOptionFromUrl(toVariableIdentifier(custom), urlValue), true);

    await tester.thenDispatchedActionsShouldEqual(
      setCurrentVariableValue(
        toVariablePayload({ type: 'custom', id: '0' }, { option: { text: 'X', value: 'X', selected: false } })
      )
    );
  });

  it('and urlValue differs but matches an option then correct actions are dispatched', async () => {
    const allValue = '.*';
    const urlValue = 'B';
    const custom = customBuilder()
      .withId('0')
      .withMulti(false)
      .withIncludeAll()
      .withAllValue(allValue)
      .withOptions('A', 'B', 'C')
      .withCurrent('A')
      .build();

    const tester = await reduxTester<{ templating: TemplatingState }>()
      .givenRootReducer(getTemplatingRootReducer())
      .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
      .whenAsyncActionIsDispatched(setOptionFromUrl(toVariableIdentifier(custom), urlValue), true);

    await tester.thenDispatchedActionsShouldEqual(
      setCurrentVariableValue(
        toVariablePayload({ type: 'custom', id: '0' }, { option: { text: 'B', value: 'B', selected: false } })
      )
    );
  });

  it('and custom all value matches an option', async () => {
    const allValue = '.*';
    const urlValue = allValue;
    const custom = customBuilder()
      .withId('0')
      .withMulti(false)
      .withIncludeAll()
      .withAllValue(allValue)
      .withOptions('A', 'B', '.*')
      .withCurrent('A')
      .build();

    custom.options[2].value = 'special value for .*';

    const tester = await reduxTester<{ templating: TemplatingState }>()
      .givenRootReducer(getTemplatingRootReducer())
      .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
      .whenAsyncActionIsDispatched(setOptionFromUrl(toVariableIdentifier(custom), urlValue), true);

    await tester.thenDispatchedActionsShouldEqual(
      setCurrentVariableValue(
        toVariablePayload(
          { type: 'custom', id: '0' },
          { option: { text: '.*', value: 'special value for .*', selected: false } }
        )
      )
    );
  });
});

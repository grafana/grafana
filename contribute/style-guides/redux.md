# Redux framework

Grafana uses [Redux Toolkit](https://redux-toolkit.js.org/) to handle Redux boilerplate code.

> **Note:** Some of our reducers are used by Angular; therefore, consider state to be mutable for those reducers.

## Test functionality

Here's how to test the functioning of your Redux reducers.

### reducerTester

Use the Fluent API framework to simplify the testing of reducers.

#### Usage

Example of `reducerTester` in use:

```typescript
reducerTester()
  .givenReducer(someReducer, initialState)
  .whenActionIsDispatched(someAction('reducer tests'))
  .thenStateShouldEqual({ ...initialState, data: 'reducer tests' });
```

#### Complex usage

Sometimes you encounter a _resulting state_ that contains properties that are hard to compare, such as `Dates`, but you still want to evaluate whether other props in state are correct.

In these cases, you can evaluate individual properties by using `thenStatePredicateShouldEqual` function on `reducerTester` that will return the resulting state. For example:

```typescript
reducerTester()
  .givenReducer(someReducer, initialState)
  .whenActionIsDispatched(someAction('reducer tests'))
  .thenStatePredicateShouldEqual((resultingState) => {
    expect(resultingState.data).toEqual('reducer tests');
    return true;
  });
```

### thunkTester

Here's a Fluent API function that simplifies the testing of thunks.

#### Usage

Example of `thunkTester` in use:

```typescript
const dispatchedActions = await thunkTester(initialState).givenThunk(someThunk).whenThunkIsDispatched(arg1, arg2, arg3);

expect(dispatchedActions).toEqual([someAction('reducer tests')]);
```

## Typing of connected props

It is possible to infer connected props automatically from `mapStateToProps` and `mapDispatchToProps` using a helper type `ConnectedProps` from Redux. For this to work properly, split the `connect` call into two parts like so:

```typescript
import { connect, ConnectedProps } from 'react-redux';

const mapStateToProps = (state: StoreState) => {
  return {
    location: state.location,
    initDone: state.panelEditor.initDone,
    uiState: state.panelEditor.ui,
  };
};

const mapDispatchToProps = {
  updateLocation,
  initPanelEditor,
  panelEditorCleanUp,
  setDiscardChanges,
  updatePanelEditorUIState,
  updateTimeZoneForSession,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = OwnProps & ConnectedProps<typeof connector>;

class PanelEditorUnconnected extends PureComponent<Props> {}

export const PanelEditor = connector(PanelEditorUnconnected);
```

For more examples, refer to the [Redux documentation](https://react-redux.js.org/using-react-redux/static-typing#inferring-the-connected-props-automatically).

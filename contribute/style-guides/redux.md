# Redux framework

Grafana uses [Redux Toolkit](https://redux-toolkit.js.org/) to handle Redux boilerplate code.
> Some of our Reducers are used by Angular and therefore state is to be considered as mutable for those reducers.

## Test functionality

### reducerTester

Fluent API that simplifies the testing of reducers

#### Usage

```typescript
reducerTester()
  .givenReducer(someReducer, initialState)
  .whenActionIsDispatched(someAction('reducer tests'))
  .thenStateShouldEqual({ ...initialState, data: 'reducer tests' });
```

#### Complex usage
Sometimes you encounter a `resulting state` that contains properties that are hard to compare, such as `Dates`, but you still want to compare that other props in state are correct.

Then you can use `thenStatePredicateShouldEqual` function on `reducerTester` that will return the `resulting state` so that you can expect upon individual properties..

```typescript
reducerTester()
  .givenReducer(someReducer, initialState)
  .whenActionIsDispatched(someAction('reducer tests'))
  .thenStatePredicateShouldEqual(resultingState => {
    expect(resultingState.data).toEqual('reducer tests');
    return true;  
  });
```

### thunkTester

Fluent API that simplifies the testing of thunks.

#### Usage

```typescript
const dispatchedActions = await thunkTester(initialState)
    .givenThunk(someThunk)
    .whenThunkIsDispatched(arg1, arg2, arg3);

expect(dispatchedActions).toEqual([someAction('reducer tests')]);
```
